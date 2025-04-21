import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Unit } from '../models/unit.model';

@Injectable({
  providedIn: 'root'
})
export class UnitService {
  private units: Unit[] = [];
  private scene!: THREE.Scene;
  private selectedUnits: Unit[] = [];
  
  // Configuración
  private isDebugMode: boolean = false;
  private readonly UNIT_SIZE: number = 0.7; // Unidades más pequeñas
  public repulsionStrength: number = 0.035; // Aumentar ligeramente la fuerza de repulsión
  
  constructor() { }
  
  initialize(scene: THREE.Scene): void {
    this.scene = scene;
  }
  
  // Crear unidades distribuidas aleatoriamente
  createUnits(numUnits: number, boardSize: number): void {
    for (let i = 0; i < numUnits; i++) {
      // Generar posición aleatoria en el tablero
      const x = (Math.random() * boardSize) - (boardSize / 2);
      const z = (Math.random() * boardSize) - (boardSize / 2);
      const position = new THREE.Vector3(x, this.UNIT_SIZE / 2, z);
      
      // Crear nueva unidad
      const unit = new Unit(this.UNIT_SIZE, position, this.scene, this.isDebugMode);
      this.units.push(unit);
    }
  }
  
  // Mover unidades seleccionadas a un punto destino
  moveUnitsTo(units: Unit[], targetPoint: THREE.Vector3): void {
    if (units.length === 0) return;
    
    // Si solo hay una unidad, moverla directamente al punto
    if (units.length === 1) {
      units[0].moveTo(targetPoint);
      return;
    }
    
    // Para múltiples unidades, distribuirlas uniformemente por la superficie del círculo
    const numUnits = units.length;
    
    // Radio del círculo proporcional al número de unidades
    const radius = Math.max(2, Math.sqrt(numUnits) * 0.8);
    
    units.forEach((unit) => {
      // Generar un punto aleatorio dentro del círculo usando el método de rechazo
      let r, theta, offsetX, offsetZ;
      
      // Para una distribución uniforme dentro del círculo
      // Usamos el método de coordenadas polares con raíz cuadrada
      r = Math.sqrt(Math.random()) * radius; // La raíz cuadrada distribuye uniformemente en el área
      theta = Math.random() * Math.PI * 2; // Ángulo aleatorio
      
      offsetX = r * Math.cos(theta);
      offsetZ = r * Math.sin(theta);
      
      const unitTarget = new THREE.Vector3(
        targetPoint.x + offsetX,
        targetPoint.y,
        targetPoint.z + offsetZ
      );
      
      unit.moveTo(unitTarget);
    });
  }
  
  // Actualizar todas las unidades (física, colisiones)
  update(): void {
    // Comprobar colisiones y aplicar repulsión entre todas las unidades
    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        const unitA = this.units[i];
        const unitB = this.units[j];
        
        if (unitA.checkCollision(unitB)) {
          // Aplicar fuerzas de repulsión en ambas direcciones
          unitA.applyRepulsion(unitB, this.repulsionStrength);
          unitB.applyRepulsion(unitA, this.repulsionStrength);
        }
      }
    }
    
    // Actualizar todas las unidades
    this.units.forEach(unit => unit.update());
  }
  
  // Seleccionar unidades dentro de un rectángulo en pantalla
  selectUnitsInRect(
    left: number, 
    right: number, 
    top: number, 
    bottom: number, 
    camera: THREE.PerspectiveCamera
  ): void {
    // Deseleccionar todas las unidades previamente seleccionadas
    this.clearSelection();
    
    // Comprobar cada unidad para ver si está dentro del rectángulo
    this.units.forEach(unit => {
      // Proyectar la posición 3D a coordenadas 2D de pantalla
      const position = new THREE.Vector3();
      position.copy(unit.mesh.position);
      position.project(camera);
      
      // Convertir a coordenadas de pantalla
      const screenX = (position.x + 1) * window.innerWidth / 2;
      const screenY = (-position.y + 1) * window.innerHeight / 2;
      
      // Comprobar si está dentro del rectángulo de selección
      if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
        this.selectUnit(unit);
      }
    });
  }
  
  // Seleccionar una unidad
  selectUnit(unit: Unit): void {
    if (!this.selectedUnits.includes(unit)) {
      this.selectedUnits.push(unit);
      unit.select();
    }
  }
  
  // Deseleccionar todas las unidades
  clearSelection(): void {
    this.selectedUnits.forEach(unit => unit.deselect());
    this.selectedUnits = [];
  }
  
  // Obtener unidades seleccionadas
  getSelectedUnits(): Unit[] {
    return this.selectedUnits;
  }
  
  // Activar/desactivar modo debug para visualizar colisiones
  setDebugMode(isDebug: boolean): void {
    this.isDebugMode = isDebug;
    this.units.forEach(unit => unit.setDebugMode(isDebug));
  }
  
  // Obtener todas las unidades
  getUnits(): Unit[] {
    return this.units;
  }
  
  // Limpiar todas las unidades
  clear(): void {
    this.units.forEach(unit => {
      this.scene.remove(unit.mesh);
      this.scene.remove(unit.collisionSphere);
      unit.dispose();
    });
    this.units = [];
    this.selectedUnits = [];
  }
} 