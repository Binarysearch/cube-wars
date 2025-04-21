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
  private ZOOM_SPEED: number = 0.1;         // Velocidad base del zoom
  private MIN_ZOOM: number = 0.3;           // Zoom mínimo (más lejos)
  private MAX_ZOOM: number = 3.0;           // Zoom máximo (más cerca)
  private readonly INITIAL_ZOOM: number = 1.0;      // Zoom inicial
  
  // Estado del zoom
  private zoomLevel: number = 1.0;
  
  constructor() { }
  
  // Inicializar el servicio con la cámara y otros elementos necesarios
  initialize(camera: THREE.PerspectiveCamera, renderer?: THREE.WebGLRenderer, gameBoard?: THREE.Mesh): void {
    this.camera = camera;
    if (renderer) this.renderer = renderer;
    if (gameBoard) this.gameBoard = gameBoard;
    
    this.zoomLevel = this.INITIAL_ZOOM;
  }
  
  // Método llamado cuando se mueve la rueda del ratón
  handleMouseWheel(event: WheelEvent): void {
    // No proceder si falta algún componente necesario
    if (!this.camera || !this.gameBoard) return;
    
    // Obtener el punto de intersección bajo el cursor
    const intersectionPoint = this.getRayIntersection(event.clientX, event.clientY);
    if (!intersectionPoint) return;
    
    // Calcular dirección de zoom: negativo = zoom out, positivo = zoom in
    const zoomDirection = -Math.sign(event.deltaY);
    
    // Guardar posición y rotación original de la cámara
    const originalPosition = this.camera.position.clone();
    const originalRotation = this.camera.rotation.clone();
    
    // Calcular el factor de zoom
    const zoomFactor = 1 + (zoomDirection * 0.1); // 10% de cambio por paso
    this.zoomLevel *= zoomFactor;
    
    // Limitar el nivel de zoom
    this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoomLevel));
    
    // Vector desde la cámara al punto de intersección
    const cameraToPoint = new THREE.Vector3().subVectors(intersectionPoint, originalPosition);
    
    // Nueva posición de la cámara: moverse en dirección al punto para zoom in,
    // o alejarse del punto para zoom out
    if (zoomDirection > 0) {
      // Zoom in: mover la cámara hacia el punto
      this.camera.position.addScaledVector(cameraToPoint.normalize(), cameraToPoint.length() * 0.1);
    } else {
      // Zoom out: mover la cámara lejos del punto
      this.camera.position.addScaledVector(cameraToPoint.normalize(), -cameraToPoint.length() * 0.1);
    }
    
    // Mantener la misma rotación para preservar el ángulo de la cámara
    this.camera.rotation.copy(originalRotation);
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
  
  // Actualizar el zoom en cada frame
  update(): void {
    // Este método ya no es necesario para la implementación simplificada
    // ya que aplicamos el zoom directamente en handleMouseWheel
  }
  
  // Resetear el zoom a su valor inicial
  resetZoom(): void {
    this.zoomLevel = this.INITIAL_ZOOM;
    
    // Resetear la posición de la cámara a la inicial
    if (this.camera) {
      this.camera.position.set(10, 10, 10);
      this.camera.lookAt(0, 0, 0);
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
    minZoom?: number;
    maxZoom?: number;
  }): void {
    if (options.speed !== undefined) {
      this.ZOOM_SPEED = options.speed;
    }
    if (options.minZoom !== undefined) {
      this.MIN_ZOOM = options.minZoom;
    }
    if (options.maxZoom !== undefined) {
      this.MAX_ZOOM = options.maxZoom;
    }
  }
} 