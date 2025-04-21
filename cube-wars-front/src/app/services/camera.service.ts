import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private gameBoard!: THREE.Mesh;
  private renderer!: THREE.WebGLRenderer;
  
  // Raycaster para detectar intersecciones
  private raycaster = new THREE.Raycaster();
  
  // Cámara de referencia para cálculos durante el panning
  private referenceCam: THREE.PerspectiveCamera | null = null;
  
  // Control de panning
  private isDragging = false;
  private initialIntersection = new THREE.Vector3();
  private currentIntersection = new THREE.Vector3();
  private initialCameraPosition = new THREE.Vector3();
  
  constructor() { }
  
  initialize(scene: THREE.Scene, renderer: THREE.WebGLRenderer, gameBoard: THREE.Mesh): void {
    this.scene = scene;
    this.renderer = renderer;
    this.gameBoard = gameBoard;
    
    // Configuración de la cámara
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);
    
    // Manejar redimensión de ventana
    window.addEventListener('resize', () => this.onWindowResize());
  }
  
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
  
  onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Si existe cámara de referencia, actualizar también
    if (this.referenceCam) {
      this.referenceCam.aspect = window.innerWidth / window.innerHeight;
      this.referenceCam.updateProjectionMatrix();
    }
  }
  
  // Método para iniciar el panning
  startPanning(clientX: number, clientY: number): void {
    this.isDragging = true;
    
    // Guardar la posición inicial de la cámara
    this.initialCameraPosition.copy(this.camera.position);
    
    // Crear una cámara de referencia que se mantendrá fija durante toda la operación
    this.referenceCam = this.camera.clone();
    
    // Obtener el punto de intersección inicial usando la cámara de referencia
    const intersectionPoint = this.getRayIntersection(clientX, clientY);
    if (intersectionPoint) {
      this.initialIntersection.copy(intersectionPoint);
    }
  }
  
  // Método para verificar si se está haciendo panning
  isPanning(): boolean {
    return this.isDragging;
  }
  
  // Método para realizar el panning durante el movimiento
  performPanning(clientX: number, clientY: number): void {
    if (!this.isDragging || !this.referenceCam) return;
    
    // Obtener el punto de intersección actual usando la cámara de referencia
    const intersectionPoint = this.getRayIntersection(clientX, clientY);
    if (!intersectionPoint) return;
    
    // Calcular la diferencia entre el punto actual y el inicial
    this.currentIntersection.copy(intersectionPoint);
    const diffX = this.currentIntersection.x - this.initialIntersection.x;
    const diffZ = this.currentIntersection.z - this.initialIntersection.z;
    
    // Mover la cámara principal en la dirección opuesta al movimiento del mouse
    this.camera.position.x = this.initialCameraPosition.x - diffX;
    this.camera.position.z = this.initialCameraPosition.z - diffZ;
    
    // Mantenemos la altura de la cámara constante
    this.camera.position.y = this.initialCameraPosition.y;
  }
  
  // Método para finalizar el panning
  stopPanning(): void {
    this.isDragging = false;
    this.referenceCam = null; // Liberar la cámara de referencia
  }
  
  // Método para obtener el punto de intersección del rayo con el tablero
  private getRayIntersection(clientX: number, clientY: number): THREE.Vector3 | null {
    // Convertir coordenadas del mouse a coordenadas normalizadas (-1 a 1)
    const mouse = new THREE.Vector2();
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
    // Usar la cámara de referencia durante el panning, de lo contrario usar la cámara principal
    const cameraToUse = (this.isDragging && this.referenceCam) ? this.referenceCam : this.camera;
    
    // Actualizar el raycaster con la posición del mouse y la cámara apropiada
    this.raycaster.setFromCamera(mouse, cameraToUse);
    
    // Calcular intersecciones con el tablero
    const intersects = this.raycaster.intersectObject(this.gameBoard);
    
    // Si hay intersección, devolver el punto
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    
    return null;
  }
}
