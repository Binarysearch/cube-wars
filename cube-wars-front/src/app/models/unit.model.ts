import * as THREE from 'three';

// Definición de equipos/civilizaciones
export enum TeamType {
  RED = 'red',
  BLUE = 'blue'
}

// Colores para cada equipo (normal y seleccionado)
export const TEAM_COLORS = {
  [TeamType.RED]: {
    normal: 0xcc0000,
    selected: 0xff6666
  },
  [TeamType.BLUE]: {
    normal: 0x0000cc,
    selected: 0x6666ff
  }
};

export class Unit {
  // Referencia al objeto 3D (cubo)
  public mesh: THREE.Mesh;
  
  // Esfera de colisión
  public collisionSphere: THREE.Mesh;
  private collisionSphereVisible: boolean = true;
  
  // Equipo/civilización
  public team: TeamType;
  
  // Física y movimiento
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public acceleration: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  
  // Sistema de movimiento hacia objetivo
  private targetPosition: THREE.Vector3 | null = null;
  private readonly MOVEMENT_SPEED: number = 0.05; // Velocidad moderada
  
  // Parámetros de configuración
  private readonly COLLISION_RADIUS_FACTOR: number = 1.8; 
  private readonly DAMPING: number = 0.95; // Factor de amortiguación para evitar movimientos perpetuos
  
  constructor(
    size: number, 
    position: THREE.Vector3, 
    scene: THREE.Scene, 
    team: TeamType = TeamType.RED,
    isDebug: boolean = false
  ) {
    // Guardar el equipo
    this.team = team;
    
    // Crear el mesh del cubo (unidad)
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({ 
      color: TEAM_COLORS[team].normal
    }); 
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    
    // La posición Y es fija para que esté apoyado en el tablero
    this.mesh.position.y = size / 2;
    
    // Crear la esfera de colisión (invisible por defecto)
    const collisionRadius = (size / 2) * this.COLLISION_RADIUS_FACTOR;
    const sphereGeometry = new THREE.SphereGeometry(collisionRadius, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      visible: isDebug
    });
    
    this.collisionSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.collisionSphere.position.copy(this.mesh.position);
    
    // Guardar referencia a la unidad en el mesh para acceso fácil
    this.mesh.userData['unit'] = this;
    
    // Añadir a la escena
    scene.add(this.mesh);
    scene.add(this.collisionSphere);
    
    this.setDebugMode(isDebug);
  }
  
  // Mover hacia un punto objetivo
  public moveTo(targetPoint: THREE.Vector3): void {
    // Establecer nuevo objetivo
    this.targetPosition = new THREE.Vector3(targetPoint.x, this.mesh.position.y, targetPoint.z);
  }
  
  // Detener el movimiento dirigido
  public stopMovement(): void {
    this.targetPosition = null;
  }
  
  // Comprobar colisión con otra unidad
  public checkCollision(other: Unit): boolean {
    const distance = this.mesh.position.distanceTo(other.mesh.position);
    const radiusSum = 
      ((this.mesh.geometry as THREE.BoxGeometry).parameters.width / 2) * this.COLLISION_RADIUS_FACTOR +
      ((other.mesh.geometry as THREE.BoxGeometry).parameters.width / 2) * this.COLLISION_RADIUS_FACTOR;
    
    return distance < radiusSum;
  }
  
  // Aplicar repulsión entre esta unidad y otra
  public applyRepulsion(other: Unit, repulsionStrength: number): void {
    const direction = new THREE.Vector3();
    direction.subVectors(this.mesh.position, other.mesh.position).normalize();
    
    // Calcular fuerza basada en la distancia (más cerca = más fuerza)
    const distance = this.mesh.position.distanceTo(other.mesh.position);
    const radiusSum = 
      ((this.mesh.geometry as THREE.BoxGeometry).parameters.width / 2) * this.COLLISION_RADIUS_FACTOR +
      ((other.mesh.geometry as THREE.BoxGeometry).parameters.width / 2) * this.COLLISION_RADIUS_FACTOR;
    
    // Escalar fuerza por la profundidad de penetración
    const forceMagnitude = repulsionStrength * (1 - distance / radiusSum);
    
    // Aplicar fuerza como aceleración
    const repulsionForce = direction.multiplyScalar(forceMagnitude);
    this.acceleration.add(repulsionForce);
  }
  
  // Actualizar física (posición y colisión)
  public update(): void {
    // Establecer la velocidad a cero inicialmente cada frame
    this.velocity.set(0, 0, 0);
    
    // Si hay un objetivo, calcular movimiento directo y uniforme hacia él
    if (this.targetPosition) {
      const direction = new THREE.Vector3();
      direction.subVectors(this.targetPosition, this.mesh.position).normalize();
      
      // Si estamos muy cerca del objetivo, detener movimiento
      if (this.mesh.position.distanceTo(this.targetPosition) < 0.2) {
        this.stopMovement();
      } else {
        // Establecer velocidad directamente (movimiento uniforme)
        const moveVelocity = direction.multiplyScalar(this.MOVEMENT_SPEED);
        this.velocity.copy(moveVelocity);
      }
    }
    
    // Sumar la aceleración por repulsión a la velocidad
    this.velocity.add(this.acceleration);
    
    // Amortiguación solo para la componente de repulsión
    // Esto mantiene el movimiento uniforme hacia el objetivo
    if (!this.targetPosition) {
      this.velocity.multiplyScalar(this.DAMPING);
    }
    
    // Si la velocidad es muy baja y no hay objetivo, detener completamente
    if (this.velocity.length() < 0.01 && !this.targetPosition) {
      this.velocity.set(0, 0, 0);
    }
    
    // Actualizar posición solo en plano horizontal (X y Z)
    this.mesh.position.x += this.velocity.x;
    this.mesh.position.z += this.velocity.z;
    
    // Sincronizar esfera de colisión
    this.collisionSphere.position.copy(this.mesh.position);
    
    // Reiniciar aceleración para el siguiente frame
    this.acceleration.set(0, 0, 0);
  }
  
  // Control de modo debug para visualizar esfera de colisión
  public setDebugMode(isDebug: boolean): void {
    this.collisionSphereVisible = isDebug;
    const material = this.collisionSphere.material as THREE.MeshBasicMaterial;
    material.visible = isDebug;
  }
  
  // Elegir esta unidad (para selección)
  public select(): void {
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(TEAM_COLORS[this.team].selected);
  }
  
  // Deseleccionar esta unidad
  public deselect(): void {
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(TEAM_COLORS[this.team].normal);
  }
  
  // Método para liberar recursos
  public dispose(): void {
    // Desreferenciar para ayudar al garbage collector
    if (this.mesh.userData['unit']) {
      this.mesh.userData['unit'] = null;
    }
  }
} 