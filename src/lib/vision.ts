import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as faceapi from '@vladmandic/face-api';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { DetectionLog, RegisteredFace } from '../types';
import { generateId } from './utils';

const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';

class VisionEngine {
  private objectDetector: cocoSsd.ObjectDetection | null = null;
  private faceMatcher: faceapi.FaceMatcher | null = null;
  public modelsLoaded = false;
  
  public lastDetectedFaces: any[] = []; // Store the latest detected faces

  private registeredFaces: RegisteredFace[] = [];
  public callbacks: {
    onModelsLoaded: () => void;
    onLogAdded: (log: DetectionLog) => void;
  } = { onModelsLoaded: () => {}, onLogAdded: () => {} };

  // For debouncing logs (don't log the same item every frame)
  private lastLogTimes: Record<string, number> = {};

  async initialize() {
    if (this.modelsLoaded) return;

    // Wait for TFJS backend to be ready
    await tf.setBackend('webgl');
    await tf.ready();

    // Load coco-ssd
    this.objectDetector = await cocoSsd.load({ base: 'mobilenet_v2' });

    // Load face-api models
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);

    this.loadRegisteredFaces();
    this.updateFaceMatcher();

    this.modelsLoaded = true;
    this.callbacks.onModelsLoaded();
  }

  private loadRegisteredFaces() {
    const saved = localStorage.getItem('vision_registered_faces');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.registeredFaces = parsed.map((f: any) => ({
          ...f,
          descriptor: new Float32Array(Object.values(f.descriptor))
        }));
      } catch (e) {
        console.error('Failed to parse registered faces', e);
      }
    }
  }

  private updateFaceMatcher() {
    if (this.registeredFaces.length > 0) {
      const labeledDescriptors = this.registeredFaces.map(
        rf => new faceapi.LabeledFaceDescriptors(rf.name, [rf.descriptor])
      );
      this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.65);
    } else {
      this.faceMatcher = null;
    }
  }

  public async registerFace(name: string): Promise<boolean> {
    if (!this.lastDetectedFaces || this.lastDetectedFaces.length === 0) return false;

    // Tomar el rostro más grande detectado
    const largestFace = this.lastDetectedFaces.sort((a, b) => b.detection.box.area - a.detection.box.area)[0];

    const newFace: RegisteredFace = {
      id: generateId(),
      name,
      descriptor: largestFace.descriptor
    };

    this.registeredFaces.push(newFace);
    localStorage.setItem('vision_registered_faces', JSON.stringify(this.registeredFaces));
    this.updateFaceMatcher();
    return true;
  }

  public getRegisteredFaces() {
    return this.registeredFaces;
  }

  public removeRegisteredFace(id: string) {
    this.registeredFaces = this.registeredFaces.filter(f => f.id !== id);
    localStorage.setItem('vision_registered_faces', JSON.stringify(this.registeredFaces));
    this.updateFaceMatcher();
  }

  private logDetection(type: 'face' | 'object' | 'expression', label: string, confidence: number) {
    const now = Date.now();
    const key = `${type}_${label}`;
    
    // Throttle logs of the exact same label to once every 5 seconds
    if (this.lastLogTimes[key] && now - this.lastLogTimes[key] < 5000) {
      return;
    }

    this.lastLogTimes[key] = now;

    const log: DetectionLog = {
      id: generateId(),
      timestamp: now,
      type,
      label,
      confidence
    };

    this.callbacks.onLogAdded(log);
  }

  public async processFrame(videoEl: HTMLVideoElement, canvas: HTMLCanvasElement) {
    if (!this.modelsLoaded || videoEl.paused || videoEl.ended) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ensure canvas dimensions match video
    if (canvas.width !== videoEl.videoWidth || canvas.height !== videoEl.videoHeight) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Object Detection
    if (this.objectDetector) {
      const objects = await this.objectDetector.detect(videoEl);
      objects.forEach(obj => {
        // Draw object bounding box
        ctx.strokeStyle = '#F59E0B'; // Amber
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(obj.bbox[0], obj.bbox[1], obj.bbox[2], obj.bbox[3]);
        ctx.stroke();

        // Draw object label background
        ctx.fillStyle = '#F59E0B';
        const text = `${obj.class} (${Math.round(obj.score * 100)}%)`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(obj.bbox[0], obj.bbox[1] > 20 ? obj.bbox[1] - 20 : 0, textWidth + 10, 20);

        // Draw object label text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText(text, obj.bbox[0] + 5, obj.bbox[1] > 20 ? obj.bbox[1] - 6 : 14);

        this.logDetection('object', obj.class, obj.score);
      });
    }

    // 2. Face Recognition & Expressions
    const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
    const faces = await faceapi.detectAllFaces(videoEl, options)
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors();

    this.lastDetectedFaces = faces;

    faces.forEach(face => {
      const box = face.detection.box;
      
      // Attempt Recognition
      let label = 'Desconocido';
      if (this.faceMatcher) {
        const match = this.faceMatcher.findBestMatch(face.descriptor);
        if (match && match.label !== 'unknown' && match.distance < 0.65) {
          label = match.label;
        }
      }

      this.logDetection('face', label, face.detection.score);

      // Best Expression
      const expressions = face.expressions as unknown as Record<string, number>;
      let bestExpression = '';
      let bestExpScore = 0;
      for (const [exp, score] of Object.entries(expressions)) {
        if (score > bestExpScore) {
          bestExpScore = score;
          bestExpression = exp;
        }
      }

      if (bestExpression && bestExpScore > 0.5) {
        const translatedExpression = this.translateExpression(bestExpression);
        this.logDetection('expression', translatedExpression, bestExpScore);
        label += ` - ${translatedExpression}`;
      }

      // Draw Face bounding box
      ctx.strokeStyle = '#6366F1'; // Indigo
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.width, box.height);
      ctx.stroke();

      // Draw label background
      ctx.fillStyle = '#6366F1';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(box.x, box.y > 20 ? box.y - 20 : 0, textWidth + 10, 20);

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText(label, box.x + 5, box.y > 20 ? box.y - 6 : 14);
    });
  }

  private translateExpression(exp: string) {
    const map: Record<string, string> = {
      neutral: 'Neutral',
      happy: 'Feliz',
      sad: 'Triste',
      angry: 'Enojado',
      fearful: 'Con Miedo',
      disgusted: 'Disgustado',
      surprised: 'Sorprendido'
    };
    return map[exp] || exp;
  }
}

export const visionEngine = new VisionEngine();
