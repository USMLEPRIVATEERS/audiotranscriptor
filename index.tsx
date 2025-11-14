/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {GoogleGenAI} from '@google/genai';
import {marked} from 'marked';

// Constants
const MODEL_NAME = 'gemini-2.5-flash';
const MAX_FILE_SIZE_MB = 50;
const MAX_TITLE_LENGTH = 60;
const MIN_TITLE_LENGTH = 3;
const RECORDING_TIMER_INTERVAL = 50;
const FFT_SIZE = 256;
const SMOOTHING_TIME_CONSTANT = 0.75;
const DEBOUNCE_DELAY = 300;

// Enums
enum RecordingStatus {
  READY = 'Ready to record',
  REQUESTING_MIC = 'Requesting microphone access...',
  PROCESSING_AUDIO = 'Processing audio...',
  CONVERTING_AUDIO = 'Converting audio...',
  GETTING_TRANSCRIPTION = 'Getting transcription...',
  TRANSCRIPTION_COMPLETE = 'Transcription complete. Polishing note...',
  POLISHING_NOTE = 'Polishing note...',
  NOTE_POLISHED = 'Note polished. Ready for next recording.',
  ERROR_MIC_PERMISSION = 'Microphone permission denied. Please check browser settings.',
  ERROR_MIC_ACCESS = 'Error accessing microphone. Please check connection.',
  ERROR_NO_AUDIO = 'No audio data captured. Please try again.',
  ERROR_PROCESSING = 'Error processing recording. Please try again.',
  ERROR_TRANSCRIPTION = 'Error getting transcription. Please try again.',
  ERROR_POLISHING = 'Error polishing note. Please try again.',
}

// Types
type ExportFormat = 'markdown' | 'txt' | 'json';
type Theme = 'light' | 'dark';

interface Note {
  id: string;
  title: string;
  rawTranscription: string;
  polishedNote: string;
  timestamp: number;
  wordCount?: number;
  duration?: number;
}

interface AppConfig {
  apiKey: string;
  modelName: string;
}

interface RecordingState {
  isRecording: boolean;
  startTime: number;
  audioChunks: Blob[];
}

class VoiceNotesApp {
  private genAI: any;
  private mediaRecorder: MediaRecorder | null = null;
  private recordButton: HTMLButtonElement;
  private recordingStatus: HTMLDivElement;
  private rawTranscription: HTMLDivElement;
  private polishedNote: HTMLDivElement;
  private newButton: HTMLButtonElement;
  private uploadButton: HTMLButtonElement;
  private audioUploadInput: HTMLInputElement;
  private themeToggleButton: HTMLButtonElement;
  private themeToggleIcon: HTMLElement;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private currentNote: Note | null = null;
  private stream: MediaStream | null = null;
  private editorTitle: HTMLDivElement;

  private recordingInterface: HTMLDivElement;
  private liveRecordingTitle: HTMLDivElement;
  private liveWaveformCanvas: HTMLCanvasElement | null;
  private liveWaveformCtx: CanvasRenderingContext2D | null = null;
  private liveRecordingTimerDisplay: HTMLDivElement;
  private statusIndicatorDiv: HTMLDivElement | null;

  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private waveformDataArray: Uint8Array | null = null;
  private waveformDrawingId: number | null = null;
  private timerIntervalId: number | null = null;
  private recordingStartTime: number = 0;

  // Sidebar and notes management
  private notes: Note[] = [];
  private sidebar: HTMLElement;
  private notesList: HTMLUListElement;
  private clearAllButton: HTMLButtonElement;
  private sidebarToggleButton: HTMLButtonElement;
  private sidebarOverlay: HTMLDivElement;
  private searchInput: HTMLInputElement;
  private exportButton: HTMLButtonElement;
  private exportAllButton: HTMLButtonElement;
  private statsButton: HTMLButtonElement;

  constructor() {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
      this.showAPIKeyError();
      throw new Error('Gemini API key not configured');
    }

    try {
      this.genAI = new GoogleGenAI({
        apiKey: apiKey,
      });
    } catch (error) {
      console.error('Error initializing Gemini AI:', error);
      this.showAPIKeyError();
      throw error;
    }

    this.recordButton = document.getElementById(
      'recordButton',
    ) as HTMLButtonElement;
    this.recordingStatus = document.getElementById(
      'recordingStatus',
    ) as HTMLDivElement;
    this.rawTranscription = document.getElementById(
      'rawTranscription',
    ) as HTMLDivElement;
    this.polishedNote = document.getElementById(
      'polishedNote',
    ) as HTMLDivElement;
    this.newButton = document.getElementById('newButton') as HTMLButtonElement;
    this.uploadButton = document.getElementById(
      'uploadButton',
    ) as HTMLButtonElement;
    this.audioUploadInput = document.getElementById(
      'audioUpload',
    ) as HTMLInputElement;
    this.themeToggleButton = document.getElementById(
      'themeToggleButton',
    ) as HTMLButtonElement;
    this.themeToggleIcon = this.themeToggleButton.querySelector(
      'i',
    ) as HTMLElement;
    this.editorTitle = document.querySelector(
      '.editor-title',
    ) as HTMLDivElement;

    this.recordingInterface = document.querySelector(
      '.recording-interface',
    ) as HTMLDivElement;
    this.liveRecordingTitle = document.getElementById(
      'liveRecordingTitle',
    ) as HTMLDivElement;
    this.liveWaveformCanvas = document.getElementById(
      'liveWaveformCanvas',
    ) as HTMLCanvasElement;
    this.liveRecordingTimerDisplay = document.getElementById(
      'liveRecordingTimerDisplay',
    ) as HTMLDivElement;

    // Sidebar elements
    this.sidebar = document.getElementById('sidebar') as HTMLElement;
    this.notesList = document.getElementById('notesList') as HTMLUListElement;
    this.clearAllButton = document.getElementById(
      'clearAllButton',
    ) as HTMLButtonElement;
    this.sidebarToggleButton = document.getElementById(
      'sidebarToggleButton',
    ) as HTMLButtonElement;
    this.sidebarOverlay = document.getElementById(
      'sidebar-overlay',
    ) as HTMLDivElement;
    this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
    this.exportButton = document.getElementById('exportButton') as HTMLButtonElement;
    this.exportAllButton = document.getElementById('exportAllButton') as HTMLButtonElement;
    this.statsButton = document.getElementById('statsButton') as HTMLButtonElement;

    if (this.liveWaveformCanvas) {
      this.liveWaveformCtx = this.liveWaveformCanvas.getContext('2d');
    }
    this.statusIndicatorDiv = this.recordingInterface.querySelector(
      '.status-indicator',
    ) as HTMLDivElement;

    this.bindEventListeners();
    this.initTheme();
    this.loadNotesFromLocalStorage();
    this.renderSidebar();
    this.createNewNote();
    this.setupKeyboardShortcuts();
    this.setupDragAndDrop();

    this.recordingStatus.textContent = RecordingStatus.READY;
  }

  private setupDragAndDrop(): void {
    const dropZone = document.body;

    dropZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleDroppedFiles(files);
      }
    });
  }

  private async handleDroppedFiles(files: FileList): Promise<void> {
    const audioFiles = Array.from(files).filter(file =>
      file.type.startsWith('audio/') ||
      /\.(mp3|m4a|opus|ogg|wav|webm)$/i.test(file.name)
    );

    if (audioFiles.length === 0) {
      this.showToast('Please drop audio files only', 3000);
      return;
    }

    const validFiles = audioFiles.filter((file) => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        console.warn(`File "${file.name}" is too large (>${MAX_FILE_SIZE_MB}MB) and will be skipped.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      this.recordingStatus.textContent = `Selected file(s) were too large (max ${MAX_FILE_SIZE_MB}MB).`;
      return;
    }

    this.processUploadedFiles(validFiles);
  }

  private async processUploadedFiles(validFiles: File[]): Promise<void> {
    this.createNewNote();
    const fileCount = validFiles.length;
    this.recordingStatus.textContent = `Processing ${fileCount} file${fileCount > 1 ? 's' : ''}...`;
    this.rawTranscription.textContent = '';
    this.rawTranscription.classList.remove('placeholder-active');
    this.polishedNote.innerHTML = '';
    this.polishedNote.classList.add('placeholder-active');

    const allTranscriptions: string[] = [];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        this.recordingStatus.textContent = `Transcribing "${file.name}" (${i + 1}/${fileCount})...`;

        const base64Audio = await this.blobToBase64(file);
        const transcriptionText = await this.fetchTranscription(base64Audio, file.type);

        if (fileCount > 1) {
          allTranscriptions.push(`--- Transcription for ${file.name} ---\n\n${transcriptionText}`);
        } else {
          allTranscriptions.push(transcriptionText);
        }

        this.rawTranscription.textContent = allTranscriptions.join('\n\n');
      }

      const combinedTranscription = allTranscriptions.join('\n\n');
      if (this.currentNote) {
        this.currentNote.rawTranscription = combinedTranscription;
        this.currentNote.wordCount = this.calculateWordCount(combinedTranscription);
      }

      if (allTranscriptions.length > 0) {
        this.recordingStatus.textContent = RecordingStatus.TRANSCRIPTION_COMPLETE;
        await this.getPolishedNote();
      } else {
        this.recordingStatus.textContent = 'No transcriptions were generated from the selected files.';
      }
    } catch (error) {
      console.error('Error processing uploaded files:', error);
      this.recordingStatus.textContent = 'An error occurred during file processing.';
      this.showToast('Error processing files', 3000);
    }
  }

  private bindEventListeners(): void {
    this.recordButton.addEventListener('click', () => this.toggleRecording());
    this.newButton.addEventListener('click', () => this.createNewNote());
    this.uploadButton.addEventListener('click', () =>
      this.audioUploadInput.click(),
    );
    this.audioUploadInput.addEventListener('change', (e) =>
      this.handleFileUpload(e),
    );
    this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
    window.addEventListener('resize', this.handleResize.bind(this));
    this.clearAllButton.addEventListener('click', () => this.clearAllNotes());
    this.sidebarToggleButton.addEventListener('click', () =>
      this.toggleSidebar(),
    );
    this.sidebarOverlay.addEventListener('click', () => this.toggleSidebar());

    // New event listeners
    this.searchInput.addEventListener('input', this.debounce(() => this.handleSearch(), DEBOUNCE_DELAY));
    this.exportButton.addEventListener('click', () => this.handleExportCurrent());
    this.exportAllButton.addEventListener('click', () => this.handleExportAll());
    this.statsButton.addEventListener('click', () => this.showStatistics());
  }

  private handleSearch(): void {
    const query = this.searchInput.value;
    const filteredNotes = this.searchNotes(query);
    this.renderFilteredNotes(filteredNotes);
  }

  private renderFilteredNotes(notes: Note[]): void {
    this.notesList.innerHTML = '';
    notes.forEach((note) => {
      this.renderNoteItem(note);
    });
  }

  private renderNoteItem(note: Note): void {
    const li = document.createElement('li');
    li.className = 'note-item';
    li.dataset.noteId = note.id;
    if (this.currentNote && note.id === this.currentNote.id) {
      li.classList.add('active');
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'note-item-title';
    titleDiv.textContent = note.title;

    const snippetDiv = document.createElement('div');
    snippetDiv.className = 'note-item-snippet';
    snippetDiv.textContent =
      note.rawTranscription.substring(0, 50) + '...';

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'note-item-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-action-btn';
    deleteBtn.title = 'Delete Note';
    deleteBtn.setAttribute('aria-label', 'Delete note');
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.deleteNote(note.id);
    };

    actionsDiv.appendChild(deleteBtn);
    li.appendChild(titleDiv);
    li.appendChild(snippetDiv);
    li.appendChild(actionsDiv);
    li.onclick = () => {
      this.displayNoteById(note.id);
      this.toggleSidebar();
    };
    this.notesList.appendChild(li);
  }

  private handleExportCurrent(): void {
    if (!this.currentNote) {
      this.showToast('No note to export', 2000);
      return;
    }

    const modal = this.createExportModal();
    document.body.appendChild(modal);

    modal.querySelectorAll('.export-format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const format = (e.currentTarget as HTMLElement).dataset.format as ExportFormat;
        this.exportNote(this.currentNote!, format);
        document.body.removeChild(modal);
        this.showToast(`Note exported as ${format.toUpperCase()}`, 2000);
      });
    });

    modal.querySelector('.export-modal-close')?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

  private handleExportAll(): void {
    if (this.notes.length === 0) {
      this.showToast('No notes to export', 2000);
      return;
    }

    const modal = this.createExportModal(true);
    document.body.appendChild(modal);

    modal.querySelectorAll('.export-format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const format = (e.currentTarget as HTMLElement).dataset.format as ExportFormat;
        this.exportAllNotes(format);
        document.body.removeChild(modal);
        this.showToast(`All notes exported as ${format.toUpperCase()}`, 2000);
      });
    });

    modal.querySelector('.export-modal-close')?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

  private createExportModal(allNotes: boolean = false): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
      <div class="export-modal-overlay"></div>
      <div class="export-modal-content">
        <button class="export-modal-close" aria-label="Close">&times;</button>
        <h3>Export ${allNotes ? 'All Notes' : 'Note'}</h3>
        <p>Choose export format:</p>
        <div class="export-format-buttons">
          <button class="export-format-btn" data-format="markdown">
            <i class="fab fa-markdown"></i>
            Markdown
          </button>
          <button class="export-format-btn" data-format="txt">
            <i class="fas fa-file-alt"></i>
            Text
          </button>
          <button class="export-format-btn" data-format="json">
            <i class="fas fa-file-code"></i>
            JSON
          </button>
        </div>
      </div>
    `;
    return modal;
  }

  private showStatistics(): void {
    if (!this.currentNote) {
      this.showToast('No note selected', 2000);
      return;
    }

    const wordCount = this.calculateWordCount(this.currentNote.polishedNote || this.currentNote.rawTranscription);
    const charCount = (this.currentNote.polishedNote || this.currentNote.rawTranscription).length;
    const date = new Date(this.currentNote.timestamp).toLocaleString();

    const modal = document.createElement('div');
    modal.className = 'stats-modal';
    modal.innerHTML = `
      <div class="export-modal-overlay"></div>
      <div class="export-modal-content">
        <button class="export-modal-close" aria-label="Close">&times;</button>
        <h3>📊 Note Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Words</span>
            <span class="stat-value">${wordCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Characters</span>
            <span class="stat-value">${charCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Created</span>
            <span class="stat-value">${date}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Notes</span>
            <span class="stat-value">${this.notes.length}</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.export-modal-close')?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('.export-modal-overlay')?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

  private toggleSidebar(): void {
    document.body.classList.toggle('sidebar-open');
  }

  private async handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const files = Array.from(input.files);

    const validFiles = files.filter((file) => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        console.warn(
          `File "${file.name}" is too large (>${MAX_FILE_SIZE_MB}MB) and will be skipped.`,
        );
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      this.recordingStatus.textContent = `Selected file(s) were too large (max ${MAX_FILE_SIZE_MB}MB).`;
      input.value = '';
      return;
    }

    await this.processUploadedFiles(validFiles);
    input.value = '';
  }

  private handleResize(): void {
    if (
      this.isRecording &&
      this.liveWaveformCanvas &&
      this.liveWaveformCanvas.style.display === 'block'
    ) {
      requestAnimationFrame(() => {
        this.setupCanvasDimensions();
      });
    }
  }

  private setupCanvasDimensions(): void {
    if (!this.liveWaveformCanvas || !this.liveWaveformCtx) return;
    const canvas = this.liveWaveformCanvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    this.liveWaveformCtx.scale(dpr, dpr);
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      this.themeToggleIcon.classList.replace('fa-sun', 'fa-moon');
    } else {
      document.body.classList.remove('light-mode');
      this.themeToggleIcon.classList.replace('fa-moon', 'fa-sun');
    }
  }

  private toggleTheme(): void {
    document.body.classList.toggle('light-mode');
    if (document.body.classList.contains('light-mode')) {
      localStorage.setItem('theme', 'light');
      this.themeToggleIcon.classList.replace('fa-sun', 'fa-moon');
    } else {
      localStorage.setItem('theme', 'dark');
      this.themeToggleIcon.classList.replace('fa-moon', 'fa-sun');
    }
  }

  private async toggleRecording(): Promise<void> {
    if (!this.isRecording) {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  private setupAudioVisualizer(): void {
    if (!this.stream || this.audioContext) return;

    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;
    this.waveformDataArray = new Uint8Array(
      this.analyserNode.frequencyBinCount,
    );
    source.connect(this.analyserNode);
  }

  private drawLiveWaveform(): void {
    if (
      !this.analyserNode ||
      !this.waveformDataArray ||
      !this.liveWaveformCtx ||
      !this.liveWaveformCanvas ||
      !this.isRecording
    ) {
      if (this.waveformDrawingId) cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
      return;
    }

    this.waveformDrawingId = requestAnimationFrame(() =>
      this.drawLiveWaveform(),
    );
    this.analyserNode.getByteFrequencyData(this.waveformDataArray);

    const ctx = this.liveWaveformCtx;
    const canvas = this.liveWaveformCanvas;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    const bufferLength = this.analyserNode.frequencyBinCount;
    const numBars = Math.floor(bufferLength * 0.5);
    if (numBars === 0) return;
    const totalBarPlusSpacingWidth = logicalWidth / numBars;
    const barWidth = Math.max(1, Math.floor(totalBarPlusSpacingWidth * 0.7));
    const barSpacing = Math.max(0, Math.floor(totalBarPlusSpacingWidth * 0.3));
    let x = 0;
    const recordingColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-recording')
        .trim() || '#ff3b30';
    ctx.fillStyle = recordingColor;

    for (let i = 0; i < numBars; i++) {
      if (x >= logicalWidth) break;
      const dataIndex = Math.floor(i * (bufferLength / numBars));
      const barHeightNormalized = this.waveformDataArray[dataIndex] / 255.0;
      let barHeight = barHeightNormalized * logicalHeight;
      if (barHeight < 1 && barHeight > 0) barHeight = 1;
      barHeight = Math.round(barHeight);
      const y = Math.round((logicalHeight - barHeight) / 2);
      ctx.fillRect(Math.floor(x), y, barWidth, barHeight);
      x += barWidth + barSpacing;
    }
  }

  private updateLiveTimer(): void {
    if (!this.isRecording || !this.liveRecordingTimerDisplay) return;
    const elapsedMs = Date.now() - this.recordingStartTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((elapsedMs % 1000) / 10);
    this.liveRecordingTimerDisplay.textContent = `${String(minutes).padStart(
      2,
      '0',
    )}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(
      2,
      '0',
    )}`;
  }

  private startLiveDisplay(): void {
    if (
      !this.recordingInterface ||
      !this.liveRecordingTitle ||
      !this.liveWaveformCanvas ||
      !this.liveRecordingTimerDisplay
    )
      return;
    this.recordingInterface.classList.add('is-live');
    this.setupCanvasDimensions();
    if (this.statusIndicatorDiv) this.statusIndicatorDiv.style.display = 'none';
    const iconElement = this.recordButton.querySelector(
      '.record-button-inner i',
    ) as HTMLElement;
    iconElement?.classList.replace('fa-microphone', 'fa-stop');
    const currentTitle = this.editorTitle.textContent?.trim();
    const placeholder =
      this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
    this.liveRecordingTitle.textContent =
      currentTitle && currentTitle !== placeholder
        ? currentTitle
        : 'New Recording';
    this.setupAudioVisualizer();
    this.drawLiveWaveform();
    this.recordingStartTime = Date.now();
    this.updateLiveTimer();
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = window.setInterval(() => this.updateLiveTimer(), 50);
  }

  private stopLiveDisplay(): void {
    this.recordingInterface.classList.remove('is-live');
    if (this.statusIndicatorDiv)
      this.statusIndicatorDiv.style.display = 'block';
    const iconElement = this.recordButton.querySelector(
      '.record-button-inner i',
    ) as HTMLElement;
    iconElement?.classList.replace('fa-stop', 'fa-microphone');
    if (this.waveformDrawingId) cancelAnimationFrame(this.waveformDrawingId);
    this.waveformDrawingId = null;
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = null;
    if (this.liveWaveformCtx && this.liveWaveformCanvas)
      this.liveWaveformCtx.clearRect(
        0,
        0,
        this.liveWaveformCanvas.width,
        this.liveWaveformCanvas.height,
      );
    if (this.audioContext && this.audioContext.state !== 'closed')
      this.audioContext.close().catch(console.warn);
    this.audioContext = null;
    this.analyserNode = null;
    this.waveformDataArray = null;
  }

  private async startRecording(): Promise<void> {
    try {
      this.audioChunks = [];
      if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
      if (this.audioContext && this.audioContext.state !== 'closed')
        await this.audioContext.close();
      this.audioContext = null;
      this.recordingStatus.textContent = 'Requesting microphone access...';
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({audio: true});
      } catch (err) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'audio/webm',
        });
      } catch (e) {
        this.mediaRecorder = new MediaRecorder(this.stream);
      }
      this.mediaRecorder.ondataavailable = (event) =>
        event.data.size > 0 && this.audioChunks.push(event.data);
      this.mediaRecorder.onstop = () => {
        this.stopLiveDisplay();
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.processAudio(audioBlob).catch(console.error);
        } else
          this.recordingStatus.textContent =
            'No audio data captured. Please try again.';
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordButton.classList.add('recording');
      this.recordButton.setAttribute('title', 'Stop Recording');
      this.startLiveDisplay();
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      if (
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError'
      )
        this.recordingStatus.textContent =
          'Microphone permission denied. Please check browser settings.';
      else
        this.recordingStatus.textContent =
          'Error accessing microphone. Please check connection.';
      this.isRecording = false;
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.stopLiveDisplay();
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.recordingStatus.textContent = 'Processing audio...';
    } else {
      if (!this.isRecording) this.stopLiveDisplay();
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1]);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    if (audioBlob.size === 0) {
      this.recordingStatus.textContent =
        'No audio data captured. Please try again.';
      return;
    }
    try {
      this.recordingStatus.textContent = 'Converting audio...';
      const base64Audio = await this.blobToBase64(audioBlob);
      const mimeType = audioBlob.type;
      if (!base64Audio || !mimeType) throw new Error('Audio conversion failed');
      await this.getTranscription(base64Audio, mimeType);
    } catch (error) {
      console.error('Error in processAudio:', error);
      this.recordingStatus.textContent =
        'Error processing recording. Please try again.';
    }
  }

  private async fetchTranscription(
    base64Audio: string,
    mimeType: string,
  ): Promise<string> {
    const contents = [
      {text: 'Generate a complete, detailed transcript of this audio.'},
      {inlineData: {mimeType: mimeType, data: base64Audio}},
    ];
    const response = await this.genAI.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
    });
    const transcriptionText = response.text;
    if (transcriptionText) {
      return transcriptionText;
    } else {
      throw new Error('Transcription returned empty.');
    }
  }

  private async getTranscription(
    base64Audio: string,
    mimeType: string,
  ): Promise<void> {
    try {
      this.recordingStatus.textContent = 'Getting transcription...';
      const transcriptionText = await this.fetchTranscription(
        base64Audio,
        mimeType,
      );
      this.rawTranscription.textContent = transcriptionText;
      this.rawTranscription.classList.remove('placeholder-active');
      if (this.currentNote)
        this.currentNote.rawTranscription = transcriptionText;
      this.recordingStatus.textContent =
        'Transcription complete. Polishing note...';
      await this.getPolishedNote();
    } catch (error) {
      console.error('Error getting transcription:', error);
      this.recordingStatus.textContent =
        'Error getting transcription. Please try again.';
    }
  }

  private async getPolishedNote(): Promise<void> {
    try {
      if (
        !this.rawTranscription.textContent ||
        this.rawTranscription.textContent.trim() === ''
      ) {
        this.recordingStatus.textContent = 'No transcription to polish';
        return;
      }
      this.recordingStatus.textContent = 'Polishing note...';
      const prompt = `Take this raw transcription and create a polished, well-formatted note. Remove filler words, repetitions, and false starts. Format lists and use markdown for headings. Maintain original content and meaning. Raw transcription: ${this.rawTranscription.textContent}`;
      const contents = [{text: prompt}];
      const response = await this.genAI.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });
      const polishedText = response.text;
      if (polishedText) {
        this.polishedNote.innerHTML = marked.parse(polishedText);
        this.polishedNote.classList.remove('placeholder-active');

        let noteTitleSet = false;
        const lines = polishedText.split('\n').map((l) => l.trim());
        for (const line of lines) {
          if (line.startsWith('#')) {
            const title = line.replace(/^#+\s+/, '').trim();
            if (this.editorTitle && title) {
              this.editorTitle.textContent = title;
              this.editorTitle.classList.remove('placeholder-active');
              noteTitleSet = true;
              break;
            }
          }
        }
        if (!noteTitleSet && this.editorTitle) {
          for (const line of lines) {
            if (line.length > 0) {
              let potentialTitle = line.replace(
                /^[\*_\`#\->\s\[\]\(.\d)]+/,
                '',
              );
              potentialTitle = potentialTitle.trim();
              if (potentialTitle.length > 3) {
                const maxLength = 60;
                this.editorTitle.textContent =
                  potentialTitle.substring(0, maxLength) +
                  (potentialTitle.length > maxLength ? '...' : '');
                this.editorTitle.classList.remove('placeholder-active');
                break;
              }
            }
          }
        }
        if (this.currentNote) this.currentNote.polishedNote = polishedText;
        this.saveOrUpdateCurrentNote();
        this.recordingStatus.textContent =
          'Note polished. Ready for next recording.';
      } else {
        this.recordingStatus.textContent =
          'Polishing failed or returned empty.';
      }
    } catch (error) {
      console.error('Error polishing note:', error);
      this.recordingStatus.textContent =
        'Error polishing note. Please try again.';
    }
  }

  private createNewNote(): void {
    this.currentNote = {
      id: `note_${Date.now()}`,
      title: '',
      rawTranscription: '',
      polishedNote: '',
      timestamp: Date.now(),
    };
    this.displayNote(this.currentNote);
    this.recordingStatus.textContent = 'Ready to record';
    if (this.isRecording) {
      this.mediaRecorder?.stop();
      this.isRecording = false;
      this.recordButton.classList.remove('recording');
    } else {
      this.stopLiveDisplay();
    }
    this.renderSidebar();
  }

  private saveOrUpdateCurrentNote(): void {
    if (!this.currentNote) return;
    this.currentNote.title =
      this.editorTitle.textContent?.trim() || 'Untitled Note';
    const hasContent =
      this.currentNote.rawTranscription.trim() ||
      this.currentNote.polishedNote.trim();
    if (!hasContent) return;

    const noteIndex = this.notes.findIndex((n) => n.id === this.currentNote!.id);
    if (noteIndex > -1) {
      this.notes[noteIndex] = this.currentNote;
    } else {
      this.notes.unshift(this.currentNote);
    }
    this.saveNotesToLocalStorage();
    this.renderSidebar();
  }

  private saveNotesToLocalStorage(): void {
    localStorage.setItem('voiceNotes', JSON.stringify(this.notes));
  }

  private loadNotesFromLocalStorage(): void {
    const savedNotes = localStorage.getItem('voiceNotes');
    if (savedNotes) {
      this.notes = JSON.parse(savedNotes);
    }
  }

  private renderSidebar(): void {
    this.renderFilteredNotes(this.notes);
  }

  private displayNote(note: Note): void {
    const titlePlaceholder =
      this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
    this.editorTitle.textContent = note.title || titlePlaceholder;
    this.editorTitle.classList.toggle(
      'placeholder-active',
      !note.title || note.title === titlePlaceholder,
    );

    const rawPlaceholder =
      this.rawTranscription.getAttribute('placeholder') || '';
    this.rawTranscription.textContent = note.rawTranscription || rawPlaceholder;
    this.rawTranscription.classList.toggle(
      'placeholder-active',
      !note.rawTranscription,
    );

    const polishedPlaceholder =
      this.polishedNote.getAttribute('placeholder') || '';
    this.polishedNote.innerHTML = note.polishedNote
      ? marked.parse(note.polishedNote)
      : polishedPlaceholder;
    this.polishedNote.classList.toggle('placeholder-active', !note.polishedNote);
  }

  private displayNoteById(noteId: string): void {
    const note = this.notes.find((n) => n.id === noteId);
    if (note) {
      this.currentNote = note;
      this.displayNote(note);
      this.renderSidebar(); // To update active state
    }
  }

  private deleteNote(noteId: string): void {
    this.notes = this.notes.filter((note) => note.id !== noteId);
    this.saveNotesToLocalStorage();
    this.renderSidebar();
    if (this.currentNote && this.currentNote.id === noteId) {
      this.createNewNote();
    }
  }

  private clearAllNotes(): void {
    if (confirm('Are you sure you want to delete all notes?')) {
      this.notes = [];
      this.saveNotesToLocalStorage();
      this.renderSidebar();
      this.createNewNote();
    }
  }

  // Export functionality
  public exportNote(note: Note, format: ExportFormat = 'markdown'): void {
    let content: string;
    let filename: string;
    let mimeType: string;

    const sanitizedTitle = this.sanitizeFilename(note.title || 'Untitled Note');
    const timestamp = new Date(note.timestamp).toISOString().split('T')[0];

    switch (format) {
      case 'markdown':
        content = `# ${note.title}\n\n**Date:** ${new Date(note.timestamp).toLocaleString()}\n\n## Polished Note\n\n${note.polishedNote}\n\n## Raw Transcription\n\n${note.rawTranscription}`;
        filename = `${sanitizedTitle}_${timestamp}.md`;
        mimeType = 'text/markdown';
        break;
      case 'txt':
        content = `${note.title}\n\nDate: ${new Date(note.timestamp).toLocaleString()}\n\nPolished Note:\n\n${note.polishedNote}\n\nRaw Transcription:\n\n${note.rawTranscription}`;
        filename = `${sanitizedTitle}_${timestamp}.txt`;
        mimeType = 'text/plain';
        break;
      case 'json':
        content = JSON.stringify(note, null, 2);
        filename = `${sanitizedTitle}_${timestamp}.json`;
        mimeType = 'application/json';
        break;
    }

    this.downloadFile(content, filename, mimeType);
  }

  public exportAllNotes(format: ExportFormat = 'json'): void {
    if (this.notes.length === 0) {
      alert('No notes to export');
      return;
    }

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const content = JSON.stringify(this.notes, null, 2);
      this.downloadFile(content, `all_notes_${timestamp}.json`, 'application/json');
    } else {
      const content = this.notes.map(note => {
        if (format === 'markdown') {
          return `# ${note.title}\n\n**Date:** ${new Date(note.timestamp).toLocaleString()}\n\n${note.polishedNote}\n\n---\n`;
        } else {
          return `${note.title}\nDate: ${new Date(note.timestamp).toLocaleString()}\n\n${note.polishedNote}\n\n---\n\n`;
        }
      }).join('\n');
      const mimeType = format === 'markdown' ? 'text/markdown' : 'text/plain';
      const extension = format === 'markdown' ? 'md' : 'txt';
      this.downloadFile(content, `all_notes_${timestamp}.${extension}`, mimeType);
    }
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  private sanitizeHTML(html: string): string {
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
  }

  private calculateWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => func(...args), delay);
    };
  }

  // Search functionality
  public searchNotes(query: string): Note[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.notes;

    return this.notes.filter(note =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.rawTranscription.toLowerCase().includes(lowerQuery) ||
      note.polishedNote.toLowerCase().includes(lowerQuery)
    );
  }

  // Keyboard shortcuts
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New note
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.createNewNote();
      }
      // Ctrl/Cmd + S: Save (auto-saves already, but gives feedback)
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveOrUpdateCurrentNote();
        this.showToast('Note saved!');
      }
      // Ctrl/Cmd + E: Export current note
      else if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (this.currentNote) {
          this.exportNote(this.currentNote, 'markdown');
        }
      }
      // Space: Toggle recording (when not typing in contenteditable)
      else if (e.code === 'Space' && !(e.target as HTMLElement).isContentEditable) {
        e.preventDefault();
        this.toggleRecording();
      }
      // Ctrl/Cmd + B: Toggle sidebar
      else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
    });
  }

  private showToast(message: string, duration: number = 2000): void {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: var(--color-accent);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      animation: slideInUp 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOutDown 0.3s ease-out';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, duration);
  }

  private showAPIKeyError(): void {
    const errorModal = document.createElement('div');
    errorModal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        font-family: var(--font-primary);
      ">
        <div style="
          background: var(--color-bg-alt);
          color: var(--color-text);
          padding: 40px;
          border-radius: 12px;
          max-width: 600px;
          box-shadow: var(--shadow-lg);
          text-align: center;
        ">
          <h2 style="color: var(--color-recording); margin-bottom: 20px; font-size: 24px;">
            ⚠️ API Key Não Configurada
          </h2>
          <p style="margin-bottom: 20px; line-height: 1.6; font-size: 16px;">
            Para usar este aplicativo, você precisa configurar sua chave da API do Google Gemini.
          </p>
          <ol style="text-align: left; margin: 20px 0; line-height: 1.8; font-size: 14px;">
            <li>Acesse <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--color-accent);">Google AI Studio</a> e gere sua API key</li>
            <li>Copie a chave gerada</li>
            <li>Crie um arquivo <code style="background: var(--color-bg); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);">.env.local</code> na raiz do projeto</li>
            <li>Adicione: <code style="background: var(--color-bg); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);">GEMINI_API_KEY=sua_chave_aqui</code></li>
            <li>Reinicie o servidor de desenvolvimento</li>
          </ol>
          <p style="margin-top: 20px; font-size: 14px; color: var(--color-text-secondary);">
            Consulte o README.md para instruções detalhadas.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(errorModal);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VoiceNotesApp();

  document
    .querySelectorAll<HTMLElement>('[contenteditable][placeholder]')
    .forEach((el) => {
      const placeholder = el.getAttribute('placeholder')!;
      function updatePlaceholderState() {
        const currentText = (
          el.id === 'polishedNote' ? el.innerText : el.textContent
        )?.trim();
        if (currentText === '' || currentText === placeholder) {
          if (el.id === 'polishedNote' && currentText === '')
            el.innerHTML = placeholder;
          else if (currentText === '') el.textContent = placeholder;
          el.classList.add('placeholder-active');
        } else {
          el.classList.remove('placeholder-active');
        }
      }
      updatePlaceholderState();
      el.addEventListener('focus', function () {
        const currentText = (
          this.id === 'polishedNote' ? this.innerText : this.textContent
        )?.trim();
        if (currentText === placeholder) {
          if (this.id === 'polishedNote') this.innerHTML = '';
          else this.textContent = '';
          this.classList.remove('placeholder-active');
        }
      });
      el.addEventListener('blur', updatePlaceholderState);
    });
});

export {};
