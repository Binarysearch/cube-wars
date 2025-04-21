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
  public repulsionStrength: number = 0.02; // Fuerza de repulsión entre unidades
  
  constructor() { }
  
  initialize(scene: THREE.Scene): void {
    this.scene = scene;
  }
  
  // Crear unidades distribuidas aleatoriamente
  createUnits(numUnits: number, boardSize: number): void {
    const unitSize = 1; // Tamaño estándar de las unidades
    
    for (let i = 0; i < numUnits; i++) {
      // Generar posición aleatoria en el tablero
      const x = (Math.random() * boardSize) - (boardSize / 2);
      const z = (Math.random() * boardSize) - (boardSize / 2);
      const position = new THREE.Vector3(x, unitSize / 2, z);
      
      // Crear nueva unidad
      const unit = new Unit(unitSize, position, this.scene, this.isDebugMode);
      this.units.push(unit);
    }
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