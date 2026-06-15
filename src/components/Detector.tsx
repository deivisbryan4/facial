import { useEffect, useRef, useState } from 'react';
import { visionEngine } from '../lib/vision';
import { Camera, ScanFace, Loader2, Fingerprint } from 'lucide-react';
import { RegisteredFace, DetectionLog } from '../types';

interface Props {
  isLoaded: boolean;
  logs: DetectionLog[];
}

export default function Detector({ isLoaded, logs }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faces, setFaces] = useState<RegisteredFace[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollName, setEnrollName] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [streamActive, setStreamActive] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setFaces(visionEngine.getRegisteredFaces());
    }
  }, [isLoaded]);

  useEffect(() => {
    let animationFrameId: number;
    let isActive = true;

    async function setupCamera() {
      if (!videoRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false
        });
        videoRef.current.srcObject = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setStreamActive(true);
          detectLoop();
        };
      } catch (e) {
        console.error('Camera access denied:', e);
      }
    }

    async function detectLoop() {
      if (!isActive) return;
      if (videoRef.current && canvasRef.current && isLoaded && !isEnrolling) {
        await visionEngine.processFrame(videoRef.current, canvasRef.current);
      }
      animationFrameId = requestAnimationFrame(detectLoop);
    }

    setupCamera();

    return () => {
      isActive = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isLoaded, isEnrolling]);

  const handleEnrollFace = async () => {
    if (!enrollName.trim()) return;
    setIsEnrolling(true);
    setEnrollError('');
    setEnrollSuccess(false);
    try {
      const success = await visionEngine.registerFace(enrollName.trim());
      if (success) {
        setFaces(visionEngine.getRegisteredFaces());
        setEnrollName('');
        setEnrollSuccess(true);
        setTimeout(() => setEnrollSuccess(false), 3000);
      } else {
        setEnrollError("No se detectó un rostro de forma clara. Acércate más o busca mejor iluminación.");
      }
    } catch (e) {
      console.error(e);
      setEnrollError("Hubo un error al procesar la cámara.");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRemoveFace = (id: string) => {
    visionEngine.removeRegisteredFace(id);
    setFaces(visionEngine.getRegisteredFaces());
  };

  // Compute stats stats
  const facesLogCount = logs.filter(l => l.type === 'face').length;
  const objectsLogCount = logs.filter(l => l.type === 'object').length;
  const activeAlerts = logs.filter(l => l.type === 'expression').length; // Changed context

  return (
    <>
      <div className="flex-1 bg-slate-300 rounded-xl relative overflow-hidden ring-4 ring-white shadow-xl min-h-0">
        
        {!isLoaded && (
          <div className="absolute inset-0 z-50 bg-slate-100 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
            <p className="font-mono text-sm">Cargando módulos de IA...</p>
          </div>
        )}

        {!streamActive && isLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-200">
            <Camera className="w-8 h-8 mb-2 opacity-50" />
            <p className="font-medium text-sm">Inicializando hardware...</p>
          </div>
        )}
        
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover" 
          playsInline 
          muted 
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full pointer-events-none" 
        />

        {/* Scanlines Overlay for aesthetic */}
        {isLoaded && streamActive && (
          <>
            <div className="absolute inset-0 pointer-events-none border-[12px] border-slate-900/10 flex flex-col justify-between p-4 mix-blend-overlay">
              <div className="flex justify-between">
                <div className="w-12 h-12 border-t-2 border-l-2 border-white opacity-40"></div>
                <div className="w-12 h-12 border-t-2 border-r-2 border-white opacity-40"></div>
              </div>
              <div className="flex justify-between">
                <div className="w-12 h-12 border-b-2 border-l-2 border-white opacity-40"></div>
                <div className="w-12 h-12 border-b-2 border-r-2 border-white opacity-40"></div>
              </div>
            </div>
            
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-md text-xs font-mono">
              CAM_01 // AUTO // ML_INFER
            </div>
          </>
        )}
      </div>

      {isLoaded && (
        <div className="shrink-0 space-y-4">
          
          {/* Quick Stats Grid */}
          <div className="h-24 grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Detecciones Hoy</p>
              <p className="text-2xl font-bold text-slate-800">{logs.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Rostros</p>
              <p className="text-2xl font-bold text-indigo-600">{facesLogCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Objetos</p>
              <p className="text-2xl font-bold text-amber-500">{objectsLogCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Gestos Detectados</p>
              <p className="text-2xl font-bold text-emerald-500">{activeAlerts}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Fingerprint className="w-5 h-5 text-indigo-500" /> 
              <h3 className="text-sm font-bold text-slate-800">Entrenamiento Facial de Seguridad</h3>
            </div>
            
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Escribe tu nombre aquí..."
                value={enrollName}
                onChange={e => setEnrollName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button 
                onClick={handleEnrollFace}
                disabled={isEnrolling || !enrollName.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-6 py-2 rounded-lg transition-colors"
              >
                {isEnrolling ? 'Procesando...' : 'Capturar ID'}
              </button>
            </div>
            {enrollError && (
              <p className="mt-3 text-xs text-rose-500 font-medium">{enrollError}</p>
            )}
            {enrollSuccess && (
              <p className="mt-3 text-xs text-emerald-500 font-medium">¡Rostro guardado correctamente!</p>
            )}
            {!enrollError && !enrollSuccess && (
              <p className="mt-3 text-[11px] text-slate-500">
                Para ser reconocido por el sistema, debes ingresar tu nombre arriba y darle clic en "Capturar ID" mientras miras a la cámara.
              </p>
            )}

            {faces.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Perfiles Activos</p>
                <div className="flex flex-wrap gap-2">
                  {faces.map(face => (
                    <div key={face.id} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
                      <span className="text-[11px] font-bold text-slate-700">{face.name}</span>
                      <button 
                        onClick={() => handleRemoveFace(face.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                        title="Eliminar"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}
