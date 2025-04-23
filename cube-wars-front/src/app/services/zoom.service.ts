import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ZoomConfig {
  speed?: number;
  minHeight?: number;
  maxHeight?: number;
  damping?: number;
  acceleration?: number;
  maxVelocity?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ZoomService implements OnDestroy {
  // Referencias
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private gameBoard?: THREE.Mesh;
  
  // Observable para el estado del zoom
  private readonly zoomHeightSubject = new BehaviorSubject<number>(0);
  public readonly zoomHeight$: Observable<number> = this.zoomHeightSubject.asObservable();
  
  // Raycaster optimizado para detectar intersecciones
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouse = new THREE.Vector2();
  
  // Configuración con valores por defecto optimizados
  private readonly DEFAULT_CONFIG = {
    ZOOM_SPEED: 0.1,
    MIN_HEIGHT: 3,
    MAX_HEIGHT: 25,
    DAMPING: 0.92,
    ZOOM_ACCELERATION: 0.05,
    MAX_VELOCITY: 0.1
  } as const;
  
  // Configuración actual
  private config = { ...this.DEFAULT_CONFIG };
  
  // Estado del zoom
  private zoomVelocity = 0;
  private lastIntersection: THREE.Vector3 | null = null;
  private readonly ORIGIN = new THREE.Vector3(0, 0, 0);
  
  // Vectores reutilizables para optimización
  private readonly tempVector = new THREE.Vector3();
  private readonly tempVector2 = new THREE.Vector3();
  
  constructor() {}
  
  ngOnDestroy(): void {
    this.zoomHeightSubject.complete();
  }
  
  /**
   * Inicializa el servicio con los componentes necesarios
   * @throws Error si la cámara no es proporcionada
   */
  initialize(camera: THREE.PerspectiveCamera, renderer?: THREE.WebGLRenderer, gameBoard?: THREE.Mesh): void {
    if (!camera) {
      throw new Error('Camera is required for ZoomService initialization');
    }
    
    this.camera = camera;
    this.renderer = renderer;
    this.gameBoard = gameBoard;
    this.zoomVelocity = 0;
    this.updateZoomHeight();
  }
  
  /**
   * Maneja el evento de la rueda del ratón para el zoom
   * @param event Evento de la rueda del ratón
   */
  handleMouseWheel(event: WheelEvent): void {
    if (!this.isInitialized()) return;
    
    const intersectionPoint = this.getRayIntersection(event.clientX, event.clientY);
    if (!intersectionPoint) return;
    
    this.lastIntersection = intersectionPoint;
    const zoomDirection = -Math.sign(event.deltaY);
    
    if (this.isAtZoomLimit(zoomDirection)) {
      this.adjustVelocityAtLimit(zoomDirection);
      return;
    }
    
    const adaptiveAcceleration = this.calculateAdaptiveAcceleration(zoomDirection);
    this.updateZoomVelocity(zoomDirection, adaptiveAcceleration);
  }
  
  /**
   * Actualiza la posición de la cámara en cada frame
   */
  update(): void {
    if (!this.shouldUpdate()) return;
    
    const originalPosition = this.camera!.position.clone();
    const originalRotation = this.camera!.rotation.clone();
    
    if (this.updateCameraHeight(originalPosition)) {
      this.updateCameraPosition(originalPosition, originalRotation);
      this.updateZoomVelocity();
      this.updateZoomHeight();
    }
  }
  
  /**
   * Resetea el zoom a su posición inicial
   */
  resetZoom(): void {
    if (!this.camera) return;
    
    this.zoomVelocity = 0;
    this.lastIntersection = null;
    
    const { x, z } = this.camera.position;
    const rotation = this.camera.rotation.clone();
    
    this.camera.position.set(x, 10, z);
    this.camera.rotation.copy(rotation);
    this.updateZoomHeight();
  }
  
  /**
   * Configura los parámetros del zoom
   */
  setZoomConfig(options: ZoomConfig): void {
    this.config = {
      ...this.config,
      ...options
    };
  }
  
  // Métodos privados de utilidad
  
  private isInitialized(): boolean {
    return !!(this.camera && this.gameBoard);
  }
  
  private isAtZoomLimit(zoomDirection: number): boolean {
    if (!this.camera) return true;
    const height = this.camera.position.y;
    return (height <= this.config.MIN_HEIGHT && zoomDirection > 0) || 
           (height >= this.config.MAX_HEIGHT && zoomDirection < 0);
  }
  
  private adjustVelocityAtLimit(zoomDirection: number): void {
    if (zoomDirection > 0) {
      this.zoomVelocity = Math.min(0, this.zoomVelocity);
    } else {
      this.zoomVelocity = Math.max(0, this.zoomVelocity);
    }
  }

  private calculateAdaptiveAcceleration(zoomDirection: number): number {
    if (!this.camera) return 0;
    
    const height = this.camera.position.y;
    const factor = zoomDirection > 0
      ? Math.min(1, (height - this.config.MIN_HEIGHT) / 3)
      : Math.min(1, (this.config.MAX_HEIGHT - height) / 3);
    
    return this.config.ZOOM_ACCELERATION * factor;
  }
  
  private updateZoomVelocity(direction?: number, acceleration?: number): void {
    if (direction !== undefined && acceleration !== undefined) {
      this.zoomVelocity += direction * acceleration;
      this.zoomVelocity = Math.max(-this.config.MAX_VELOCITY, 
                                  Math.min(this.config.MAX_VELOCITY, this.zoomVelocity));
    } else {
      const closeToLimit = this.isCloseToHeightLimit();
      this.zoomVelocity *= closeToLimit ? 0.5 : this.config.DAMPING;
      
      if (Math.abs(this.zoomVelocity) < 0.0001) {
        this.zoomVelocity = 0;
      }
    }
  }
  
  private updateCameraHeight(originalPosition: THREE.Vector3): boolean {
    if (!this.camera) return false;
    
    const heightChange = this.camera.position.y * this.zoomVelocity;
    const newHeight = this.camera.position.y - heightChange;
    
    if (newHeight < this.config.MIN_HEIGHT) {
      this.camera.position.y = this.config.MIN_HEIGHT;
      this.zoomVelocity = 0;
    } else if (newHeight > this.config.MAX_HEIGHT) {
      this.camera.position.y = this.config.MAX_HEIGHT;
      this.zoomVelocity = 0;
    } else {
      this.camera.position.y = newHeight;
    }
    
    return true;
  }
  
  private updateCameraPosition(originalPosition: THREE.Vector3, originalRotation: THREE.Euler): void {
    if (!this.camera || !this.lastIntersection) return;
    
    this.tempVector.subVectors(originalPosition, this.lastIntersection);
    const heightRatio = this.camera.position.y / originalPosition.y;
    
    this.tempVector2.copy(this.tempVector).multiplyScalar(heightRatio);
    this.camera.position.x = this.lastIntersection.x + this.tempVector2.x;
    this.camera.position.z = this.lastIntersection.z + this.tempVector2.z;
    this.camera.rotation.copy(originalRotation);
  }
  
  private getRayIntersection(clientX: number, clientY: number): THREE.Vector3 | null {
    if (!this.isInitialized()) return null;
    
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera!);
    const intersects = this.raycaster.intersectObject(this.gameBoard!);
    
    return intersects.length > 0 ? intersects[0].point : null;
  }
  
  private isCloseToHeightLimit(): boolean {
    if (!this.camera) return false;
    const height = this.camera.position.y;
    return Math.abs(height - this.config.MIN_HEIGHT) < 1 || 
           Math.abs(height - this.config.MAX_HEIGHT) < 1;
  }
  
  private shouldUpdate(): boolean {
    return this.isInitialized() && 
           (Math.abs(this.zoomVelocity) >= 0.0001) && 
           !!this.lastIntersection;
  }
  
  private updateZoomHeight(): void {
    if (this.camera) {
      this.zoomHeightSubject.next(this.camera.position.y);
    }
  }
}