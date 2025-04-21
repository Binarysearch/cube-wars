import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class ZoomService {
  // Referencias
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private gameBoard!: THREE.Mesh;
  
  // Raycaster para detectar intersecciones
  private raycaster = new THREE.Raycaster();
  
  // Configuración
  private ZOOM_SPEED: number = 0.1;
  private MIN_HEIGHT: number = 3;          // Altura mínima de la cámara (zoom máximo)
  private MAX_HEIGHT: number = 25;         // Altura máxima de la cámara (zoom mínimo)
  private DAMPING: number = 0.9;
  private ZOOM_ACCELERATION: number = 0.05;
  private MAX_VELOCITY: number = 0.1;
  private ORIGIN = new THREE.Vector3(0, 0, 0); // Centro del tablero
  
  // Estado del zoom
  private zoomVelocity: number = 0;
  
  // Punto de intersección bajo el cursor
  private lastIntersection: THREE.Vector3 | null = null;
  
  constructor() { }
  
  // Inicializar el servicio con la cámara y otros elementos necesarios
  initialize(camera: THREE.PerspectiveCamera, renderer?: THREE.WebGLRenderer, gameBoard?: THREE.Mesh): void {
    this.camera = camera;
    if (renderer) this.renderer = renderer;
    if (gameBoard) this.gameBoard = gameBoard;
    
    this.zoomVelocity = 0;
  }
  
  // Método llamado cuando se mueve la rueda del ratón
  handleMouseWheel(event: WheelEvent): void {
    // No proceder si falta algún componente necesario
    if (!this.camera || !this.gameBoard) return;
    
    // Obtener el punto de intersección bajo el cursor
    const intersectionPoint = this.getRayIntersection(event.clientX, event.clientY);
    if (!intersectionPoint) return; // Necesitamos un punto de intersección
    
    // Guardar el punto de intersección para centrar el zoom
    this.lastIntersection = intersectionPoint.clone();
    
    // Calcular dirección de zoom: negativo = zoom out, positivo = zoom in
    const zoomDirection = -Math.sign(event.deltaY);
    
    // Obtener la altura actual de la cámara
    const currentHeight = this.camera.position.y;
    
    // Verificar si estamos en límites y ajustar
    if ((currentHeight <= this.MIN_HEIGHT && zoomDirection > 0) || 
        (currentHeight >= this.MAX_HEIGHT && zoomDirection < 0)) {
      // Ya estamos en un límite, no añadir más velocidad en esa dirección
      if (zoomDirection > 0) {
        this.zoomVelocity = Math.min(0, this.zoomVelocity);
      } else {
        this.zoomVelocity = Math.max(0, this.zoomVelocity);
      }
      return;
    }
    
    // Calcular factor adaptativo basado en la altura - más cerca del límite = menos aceleración
    let adaptiveAcceleration = this.ZOOM_ACCELERATION;
    
    if (zoomDirection > 0) { // Zoom in
      const heightFromMin = currentHeight - this.MIN_HEIGHT;
      const minFactor = Math.min(1, heightFromMin / 3); // Reducir aceleración a 3 unidades del mínimo
      adaptiveAcceleration *= minFactor;
    } else { // Zoom out
      const heightFromMax = this.MAX_HEIGHT - currentHeight;
      const maxFactor = Math.min(1, heightFromMax / 3);
      adaptiveAcceleration *= maxFactor;
    }
    
    // Añadir velocidad con aceleración adaptativa
    this.zoomVelocity += zoomDirection * adaptiveAcceleration;
    
    // Limitar velocidad máxima
    this.zoomVelocity = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, this.zoomVelocity));
  }
  
  // Actualizar el zoom en cada frame para suavizarlo
  update(): void {
    if (!this.camera || Math.abs(this.zoomVelocity) < 0.0001 || !this.lastIntersection) return;
    
    // Guardar posición original antes del zoom
    const originalPosition = this.camera.position.clone();
    const originalRotation = this.camera.rotation.clone();
    
    // Calcular nuevo cambio de altura basado en la velocidad
    const heightChange = this.camera.position.y * this.zoomVelocity;
    
    // Predecir nueva altura
    const newHeight = this.camera.position.y - heightChange; // Invertido porque zoom in = bajar cámara
    
    // Verificar límites y ajustar velocidad si es necesario
    if (newHeight < this.MIN_HEIGHT) {
      // Calcular el cambio exacto para llegar al mínimo
      const maxChange = this.camera.position.y - this.MIN_HEIGHT;
      const adjustedVelocity = maxChange / this.camera.position.y;
      
      // Aplicar el cambio limitado y detener la velocidad
      this.camera.position.y = this.MIN_HEIGHT;
      this.zoomVelocity = 0;
    } else if (newHeight > this.MAX_HEIGHT) {
      // Calcular el cambio exacto para llegar al máximo
      const maxChange = this.MAX_HEIGHT - this.camera.position.y;
      const adjustedVelocity = maxChange / this.camera.position.y;
      
      // Aplicar el cambio limitado y detener la velocidad
      this.camera.position.y = this.MAX_HEIGHT;
      this.zoomVelocity = 0;
    } else {
      // Cambio normal dentro de los límites
      this.camera.position.y = newHeight;
    }
    
    // Calcular vector desde el punto de intersección a la cámara original
    const toCameraVector = new THREE.Vector3().subVectors(originalPosition, this.lastIntersection);
    
    // Calcular la relación de cambio de altura
    const heightRatio = this.camera.position.y / originalPosition.y;
    
    // Ajustar la posición X,Z para mantener el punto de intersección bajo el cursor
    const newToCameraVector = toCameraVector.clone().multiplyScalar(heightRatio);
    const newCameraPosition = new THREE.Vector3().addVectors(this.lastIntersection, newToCameraVector);
    
    // Actualizar sólo X y Z, manteniendo Y que ya fue calculado
    this.camera.position.x = newCameraPosition.x;
    this.camera.position.z = newCameraPosition.z;
    
    // Restaurar la rotación original para mantener el ángulo
    this.camera.rotation.copy(originalRotation);
    
    // Ajustar amortiguación según cercanía a los límites
    const closeToMin = Math.abs(this.camera.position.y - this.MIN_HEIGHT) < 1;
    const closeToMax = Math.abs(this.camera.position.y - this.MAX_HEIGHT) < 1;
    
    if ((closeToMin && this.zoomVelocity > 0) || (closeToMax && this.zoomVelocity < 0)) {
      // Reducir velocidad más drásticamente cerca de los límites
      this.zoomVelocity *= 0.5;
    } else {
      // Amortiguación normal
      this.zoomVelocity *= this.DAMPING;
    }
    
    // Si la velocidad es muy pequeña, detenerla
    if (Math.abs(this.zoomVelocity) < 0.0001) {
      this.zoomVelocity = 0;
    }
  }
  
  // Método para obtener el punto de intersección del rayo con el tablero
  private getRayIntersection(clientX: number, clientY: number): THREE.Vector3 | null {
    if (!this.camera || !this.gameBoard) return null;
    
    // Convertir coordenadas del mouse a coordenadas normalizadas (-1 a 1)
    const mouse = new THREE.Vector2();
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    // Actualizar el raycaster con la posición del mouse
    this.raycaster.setFromCamera(mouse, this.camera);
    
    // Calcular intersecciones con el tablero
    const intersects = this.raycaster.intersectObject(this.gameBoard);
    
    // Si hay intersección, devolver el punto
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    
    return null;
  }
  
  // Resetear el zoom a su valor inicial
  resetZoom(): void {
    this.zoomVelocity = 0;
    this.lastIntersection = null;
    
    // Resetear la posición de la cámara a la inicial
    if (this.camera) {
      // Guardar rotación y posición X,Z originales
      const originalRotation = this.camera.rotation.clone();
      const originalX = this.camera.position.x;
      const originalZ = this.camera.position.z;
      
      // Restaurar altura inicial
      this.camera.position.y = 10;
      
      // Restaurar X,Z y rotación originales para no afectar al panning
      this.camera.position.x = originalX;
      this.camera.position.z = originalZ;
      this.camera.rotation.copy(originalRotation);
    }
  }
  
  // Establecer referencias a elementos necesarios
  setGameBoard(gameBoard: THREE.Mesh): void {
    this.gameBoard = gameBoard;
  }
  
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
  }
  
  // Ajustar las constantes de configuración
  setZoomConfig(options: {
    speed?: number;
    minHeight?: number;
    maxHeight?: number;
    damping?: number;
    acceleration?: number;
    maxVelocity?: number;
  }): void {
    if (options.speed !== undefined) {
      this.ZOOM_SPEED = options.speed;
    }
    if (options.minHeight !== undefined) {
      this.MIN_HEIGHT = options.minHeight;
    }
    if (options.maxHeight !== undefined) {
      this.MAX_HEIGHT = options.maxHeight;
    }
    if (options.damping !== undefined) {
      this.DAMPING = options.damping;
    }
    if (options.acceleration !== undefined) {
      this.ZOOM_ACCELERATION = options.acceleration;
    }
    if (options.maxVelocity !== undefined) {
      this.MAX_VELOCITY = options.maxVelocity;
    }
  }
  
  // Obtener la altura actual (para depuración)
  getCurrentHeight(): number {
    if (!this.camera) return 0;
    return this.camera.position.y;
  }
} 