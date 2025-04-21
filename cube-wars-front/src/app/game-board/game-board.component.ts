import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy, HostListener, Renderer2 } from '@angular/core';
import * as THREE from 'three';
import { CameraService } from '../services/camera.service';
import { UnitService } from '../services/unit.service';

@Component({
  selector: 'app-game-board',
  standalone: true,
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.css'
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;

  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private gameBoard!: THREE.Mesh;
  private animationFrameId: number | null = null;
  
  // Configuración del juego
  private readonly BOARD_SIZE: number = 20;
  private readonly NUM_UNITS: number = 50;
  private isDebugMode: boolean = true;

  constructor(
    private cameraService: CameraService,
    private unitService: UnitService,
    private renderer2: Renderer2
  ) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.createGameBoard();
    this.createUnits();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Liberar recursos
    this.unitService.clear();
    this.renderer.dispose();
    this.scene.clear();
  }

  // HostListener para eventos del ratón
  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    // Botón medio (rueda) para panning
    if (event.button === 1) {
      this.cameraService.startPanning(event.clientX, event.clientY);
      // Añadir clase para mostrar el cursor de panning
      this.renderer2.addClass(this.gameContainer.nativeElement, 'panning-active');
    } 
    // Botón izquierdo para selección
    else if (event.button === 0) {
      this.startSelection(event.clientX, event.clientY);
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    // Panning con cámara
    this.cameraService.performPanning(event.clientX, event.clientY);
    
    // Actualización del rectángulo de selección
    this.updateSelection(event.clientX, event.clientY);
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    // Botón medio (rueda) para panning
    if (event.button === 1) {
      this.cameraService.stopPanning();
      // Quitar clase de panning
      this.renderer2.removeClass(this.gameContainer.nativeElement, 'panning-active');
    } 
    // Botón izquierdo para selección
    else if (event.button === 0) {
      this.endSelection();
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    // Si estaba haciendo panning, quitar la clase también
    if (this.cameraService.isPanning()) {
      this.renderer2.removeClass(this.gameContainer.nativeElement, 'panning-active');
    }
    this.cameraService.stopPanning();
    this.cancelSelection();
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: Event): void {
    // Prevenir la aparición del menú contextual del navegador
    event.preventDefault();
  }

  // También podemos cancelar la selección al pulsar ESC
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelSelection();
      // Si estaba haciendo panning, detenerlo y quitar la clase
      if (this.cameraService.isPanning()) {
        this.cameraService.stopPanning();
        this.renderer2.removeClass(this.gameContainer.nativeElement, 'panning-active');
      }
    } else if (event.key === 'D' || event.key === 'd') {
      // Activar/desactivar modo debug con tecla D
      this.isDebugMode = !this.isDebugMode;
      this.unitService.setDebugMode(this.isDebugMode);
    }
  }

  private initThreeJS(): void {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.gameContainer.nativeElement.appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
    
    // Inicializar servicios
    this.cameraService.initialize(this.scene, this.renderer, this.gameBoard);
    this.unitService.initialize(this.scene);
  }

  private createGameBoard(): void {
    const geometry = new THREE.PlaneGeometry(this.BOARD_SIZE, this.BOARD_SIZE);
    const material = new THREE.MeshStandardMaterial({
      color: 0x444444,
      side: THREE.DoubleSide,
      roughness: 0.7
    });
    this.gameBoard = new THREE.Mesh(geometry, material);
    this.gameBoard.rotation.x = -Math.PI / 2; // Make it horizontal
    this.gameBoard.position.y = 0;
    this.scene.add(this.gameBoard);

    // Add a grid to help visualize the plane
    const gridHelper = new THREE.GridHelper(this.BOARD_SIZE, this.BOARD_SIZE / 2);
    this.scene.add(gridHelper);

    // Actualizar el servicio de cámara con el tablero creado
    this.cameraService.initialize(this.scene, this.renderer, this.gameBoard);
  }

  private createUnits(): void {
    // Crear unidades a través del servicio
    this.unitService.createUnits(this.NUM_UNITS, this.BOARD_SIZE);
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    
    // Actualizar la física y colisiones de las unidades
    this.unitService.update();
    
    // Renderizar la escena
    this.renderer.render(this.scene, this.cameraService.getCamera());
  }
  
  // Variables para control de selección
  private isSelecting: boolean = false;
  private selectionBox: HTMLElement | null = null;
  private startPoint = { x: 0, y: 0 };
  private endPoint = { x: 0, y: 0 };
  
  // Iniciar selección
  private startSelection(clientX: number, clientY: number): void {
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
      this.renderer2.appendChild(this.gameContainer.nativeElement, this.selectionBox);
    }
  }
  
  // Actualizar selección
  private updateSelection(clientX: number, clientY: number): void {
    if (!this.isSelecting || !this.selectionBox) return;
    
    this.endPoint.x = clientX;
    this.endPoint.y = clientY;
    
    // Solo mostrar el rectángulo si hay un movimiento significativo
    const dragDistance = Math.sqrt(
      Math.pow(this.endPoint.x - this.startPoint.x, 2) + 
      Math.pow(this.endPoint.y - this.startPoint.y, 2)
    );
    
    if (dragDistance > 5) {
      this.renderer2.setStyle(this.selectionBox, 'display', 'block');
      
      // Calcular las dimensiones del rectángulo
      const left = Math.min(this.startPoint.x, this.endPoint.x);
      const top = Math.min(this.startPoint.y, this.endPoint.y);
      const width = Math.abs(this.endPoint.x - this.startPoint.x);
      const height = Math.abs(this.endPoint.y - this.startPoint.y);
      
      // Actualizar posición y tamaño del rectángulo
      this.renderer2.setStyle(this.selectionBox, 'left', `${left}px`);
      this.renderer2.setStyle(this.selectionBox, 'top', `${top}px`);
      this.renderer2.setStyle(this.selectionBox, 'width', `${width}px`);
      this.renderer2.setStyle(this.selectionBox, 'height', `${height}px`);
    }
  }
  
  // Finalizar selección
  private endSelection(): void {
    if (!this.isSelecting || !this.selectionBox) return;
    
    // Ocultar el rectángulo de selección
    this.renderer2.setStyle(this.selectionBox, 'display', 'none');
    
    // Calcular dimensiones del rectángulo
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const right = Math.max(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);
    const bottom = Math.max(this.startPoint.y, this.endPoint.y);
    
    // Calcular distancia de arrastre
    const dragDistance = Math.sqrt(
      Math.pow(this.endPoint.x - this.startPoint.x, 2) + 
      Math.pow(this.endPoint.y - this.startPoint.y, 2)
    );
    
    // Si no hubo arrastre, deseleccionar unidades
    if (dragDistance <= 5) {
      this.unitService.clearSelection();
    } else {
      // Seleccionar unidades en el rectángulo
      this.unitService.selectUnitsInRect(
        left, right, top, bottom,
        this.cameraService.getCamera()
      );
    }
    
    this.isSelecting = false;
  }
  
  // Cancelar selección
  private cancelSelection(): void {
    if (this.isSelecting && this.selectionBox) {
      this.renderer2.setStyle(this.selectionBox, 'display', 'none');
      this.isSelecting = false;
    }
  }
}
