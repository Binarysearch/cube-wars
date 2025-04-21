import { Injectable, ElementRef, Renderer2 } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class SelectionService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private gameBoard!: THREE.Mesh;
  private cubes: THREE.Mesh[] = [];
  private selectedCubes: THREE.Mesh[] = [];
  
  // Para guardar las líneas de contorno de los cubos seleccionados
  private outlineObjects: THREE.LineSegments[] = [];
  
  // Elemento DOM del rectángulo de selección
  private selectionBox: HTMLElement | null = null;
  private containerElement: ElementRef | null = null;
  private renderer2: Renderer2 | null = null;
  
  // Control de selección
  private isSelecting = false;
  private startPoint = { x: 0, y: 0 };
  private endPoint = { x: 0, y: 0 };
  
  constructor() { }
  
  initialize(
    scene: THREE.Scene, 
    camera: THREE.PerspectiveCamera, 
    renderer: THREE.WebGLRenderer, 
    gameBoard: THREE.Mesh,
    cubes: THREE.Mesh[],
    containerElement: ElementRef,
    renderer2: Renderer2
  ): void {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.gameBoard = gameBoard;
    this.cubes = cubes;
    this.containerElement = containerElement;
    this.renderer2 = renderer2;
  }
  
  // Método para iniciar la selección
  startSelection(clientX: number, clientY: number): void {
    if (!this.renderer2 || !this.containerElement) return;
    
    this.isSelecting = true;
    this.startPoint.x = clientX;
    this.startPoint.y = clientY;
    this.endPoint.x = clientX;
    this.endPoint.y = clientY;
    
    // Crear el elemento del rectángulo de selección si no existe
    if (!this.selectionBox) {
      this.selectionBox = this.renderer2.createElement('div');
      this.renderer2.addClass(this.selectionBox, 'selection-box');
      this.renderer2.setStyle(this.selectionBox, 'position', 'absolute');
      this.renderer2.setStyle(this.selectionBox, 'border', '1px solid rgba(0, 255, 255, 0.7)');
      this.renderer2.setStyle(this.selectionBox, 'background', 'rgba(0, 255, 255, 0.1)');
      this.renderer2.setStyle(this.selectionBox, 'pointer-events', 'none');
      this.renderer2.setStyle(this.selectionBox, 'display', 'none');
      this.renderer2.appendChild(this.containerElement.nativeElement, this.selectionBox);
    }
  }
  
  // Método para actualizar la selección durante el movimiento
  updateSelection(clientX: number, clientY: number): void {
    if (!this.isSelecting || !this.selectionBox) return;
    
    this.endPoint.x = clientX;
    this.endPoint.y = clientY;
    
    // Solo mostrar el rectángulo si hay un movimiento significativo
    const dragDistance = Math.sqrt(
      Math.pow(this.endPoint.x - this.startPoint.x, 2) + 
      Math.pow(this.endPoint.y - this.startPoint.y, 2)
    );
    
    if (dragDistance > 5) {
      this.renderer2?.setStyle(this.selectionBox, 'display', 'block');
      
      // Calcular las dimensiones del rectángulo
      const left = Math.min(this.startPoint.x, this.endPoint.x);
      const top = Math.min(this.startPoint.y, this.endPoint.y);
      const width = Math.abs(this.endPoint.x - this.startPoint.x);
      const height = Math.abs(this.endPoint.y - this.startPoint.y);
      
      // Actualizar posición y tamaño del rectángulo
      this.renderer2?.setStyle(this.selectionBox, 'left', `${left}px`);
      this.renderer2?.setStyle(this.selectionBox, 'top', `${top}px`);
      this.renderer2?.setStyle(this.selectionBox, 'width', `${width}px`);
      this.renderer2?.setStyle(this.selectionBox, 'height', `${height}px`);
    }
  }
  
  // Método para finalizar la selección
  endSelection(): void {
    if (!this.isSelecting || !this.selectionBox) return;
    
    // Ocultar el rectángulo de selección
    this.renderer2?.setStyle(this.selectionBox, 'display', 'none');
    
    // Calcular las dimensiones del rectángulo para comprobar selección
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const right = Math.max(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);
    const bottom = Math.max(this.startPoint.y, this.endPoint.y);
    
    // Calcular la distancia de arrastre
    const dragDistance = Math.sqrt(
      Math.pow(this.endPoint.x - this.startPoint.x, 2) + 
      Math.pow(this.endPoint.y - this.startPoint.y, 2)
    );
    
    // Si no hubo arrastre significativo, simplemente desseleccionar todos los cubos
    if (dragDistance <= 5) {
      this.clearSelection();
    } 
    // Si hubo arrastre, seleccionar los cubos dentro del rectángulo
    else {
      // Desseleccionar todos los cubos previamente seleccionados
      this.clearSelection();
      
      // Comprobar qué cubos están dentro del rectángulo
      this.cubes.forEach(cube => {
        // Proyectar la posición 3D del cubo a coordenadas 2D de pantalla
        const position = new THREE.Vector3();
        position.copy(cube.position);
        position.project(this.camera);
        
        // Convertir a coordenadas de pantalla
        const screenX = (position.x + 1) * window.innerWidth / 2;
        const screenY = (-position.y + 1) * window.innerHeight / 2;
        
        // Comprobar si el cubo está dentro del rectángulo de selección
        if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
          this.selectCube(cube);
        }
      });
    }
    
    this.isSelecting = false;
  }
  
  // Método para seleccionar un cubo
  private selectCube(cube: THREE.Mesh): void {
    if (!this.selectedCubes.includes(cube)) {
      this.selectedCubes.push(cube);
      
      // Aplicar efecto visual para indicar selección (cambio de color a verde)
      if (cube.material instanceof THREE.MeshStandardMaterial) {
        // Guardar el color original si es la primera vez que se selecciona
        if (!cube.userData['originalColor']) {
          cube.userData['originalColor'] = cube.material.color.clone();
        }
        
        // Cambiar el color a verde
        cube.material.color.setHex(0x00ff00); // Verde brillante
        
        // Añadir un contorno (wireframe) para mejor visualización
        this.addOutline(cube);
      }
    }
  }
  
  // Método para añadir un contorno al cubo seleccionado
  private addOutline(cube: THREE.Mesh): void {
    // Obtener las dimensiones del cubo original
    const cubeGeometry = cube.geometry as THREE.BoxGeometry;
    
    // Crear un wireframe ligeramente más grande que el cubo
    const geometry = new THREE.BoxGeometry(
      1.05, // Ancho con un 5% extra
      1.05, // Alto con un 5% extra
      1.05  // Profundidad con un 5% extra
    );
    
    const wireframe = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      wireframe,
      new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 })
    );
    
    // Posicionar el wireframe en la misma posición que el cubo
    line.position.copy(cube.position);
    line.rotation.copy(cube.rotation);
    line.scale.copy(cube.scale);
    
    // Asociar el wireframe con el cubo para referencia futura
    cube.userData['outline'] = line;
    
    // Añadir el wireframe a la escena y guardarlo para limpiar después
    this.scene.add(line);
    this.outlineObjects.push(line);
  }
  
  // Método para desseleccionar todos los cubos
  clearSelection(): void {
    this.selectedCubes.forEach(cube => {
      if (cube.material instanceof THREE.MeshStandardMaterial) {
        // Restaurar color original (gris)
        if (cube.userData['originalColor']) {
          cube.material.color.copy(cube.userData['originalColor']);
        } else {
          // Color por defecto (gris) por si acaso
          cube.material.color.setHex(0x888888);
        }
      }
      
      // Eliminar el contorno si existe
      if (cube.userData['outline']) {
        this.scene.remove(cube.userData['outline']);
        cube.userData['outline'] = null;
      }
    });
    
    // Limpiar todos los objetos de contorno de la escena
    this.outlineObjects.forEach(outline => {
      this.scene.remove(outline);
      outline.geometry.dispose();
      if (outline.material instanceof THREE.Material) {
        outline.material.dispose();
      } else if (Array.isArray(outline.material)) {
        outline.material.forEach(material => material.dispose());
      }
    });
    this.outlineObjects = [];
    
    this.selectedCubes = [];
  }
  
  // Método para obtener los cubos seleccionados
  getSelectedCubes(): THREE.Mesh[] {
    return this.selectedCubes;
  }
  
  // Método para cancelar la selección (por ejemplo, al pulsar ESC)
  cancelSelection(): void {
    if (this.isSelecting && this.selectionBox) {
      this.renderer2?.setStyle(this.selectionBox, 'display', 'none');
      this.isSelecting = false;
    }
  }
} 