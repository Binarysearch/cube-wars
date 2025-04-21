import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import * as THREE from 'three';
import { CameraService } from '../services/camera.service';

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
  private cubes: THREE.Mesh[] = [];
  private animationFrameId: number | null = null;

  constructor(private cameraService: CameraService) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.createGameBoard();
    this.createCubes();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Dispose of resources
    this.renderer.dispose();
    this.scene.clear();
  }

  // HostListener para eventos del ratón
  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    this.cameraService.startPanning(event.clientX, event.clientY);
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.cameraService.performPanning(event.clientX, event.clientY);
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    this.cameraService.stopPanning();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.cameraService.stopPanning();
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
  }

  private createGameBoard(): void {
    const geometry = new THREE.PlaneGeometry(20, 20);
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
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    // Inicializar el servicio de cámara después de crear el tablero
    this.cameraService.initialize(this.scene, this.renderer, this.gameBoard);
  }

  private createCubes(): void {
    // Create several cubes with different colors
    const cubeColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
    const cubeSize = 1;
    
    for (let i = 0; i < 5; i++) {
      const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
      const material = new THREE.MeshStandardMaterial({ color: cubeColors[i] });
      const cube = new THREE.Mesh(geometry, material);
      
      // Position the cubes at different locations
      const x = (i - 2) * 2;
      cube.position.set(x, cubeSize / 2, x); // y is half the height to sit on the plane
      
      this.scene.add(cube);
      this.cubes.push(cube);
    }
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    
    // Animate the cubes
    this.cubes.forEach((cube, index) => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
    });
    
    // Usar la cámara del servicio para el renderizado
    this.renderer.render(this.scene, this.cameraService.getCamera());
  }
}
