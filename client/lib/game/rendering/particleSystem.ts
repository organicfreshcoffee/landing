import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private particleGeometry!: THREE.BufferGeometry;
  private particleMaterial!: THREE.PointsMaterial;
  private particleSystem!: THREE.Points;
  private scene: THREE.Scene;
  private maxParticles = 200;
  private clock = new THREE.Clock();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeParticleSystem();
  }

  private initializeParticleSystem(): void {
    // Create geometry for particles
    this.particleGeometry = new THREE.BufferGeometry();
    
    // Create material with transparency and blending for magical effect
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0x4488ff,
      size: 0.15,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
      alphaTest: 0.1
    });

    // Create particle system
    this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particleSystem);

    // Initialize buffers
    this.updateParticleBuffers();
  }

  public castSpell(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('🎆 ParticleSystem.castSpell called!', {
      from: fromPosition,
      to: toPosition,
      currentParticleCount: this.particles.length
    });
    
    const direction = new THREE.Vector3().subVectors(toPosition, fromPosition).normalize();
    const distance = fromPosition.distanceTo(toPosition);
    
    // Create multiple particles for the spell effect
    const particleCount = Math.min(40, Math.floor(distance * 3) + 15);
    console.log('🌟 Creating', particleCount, 'particles');
    
    for (let i = 0; i < particleCount; i++) {
      // Create particles along the path with some spread
      const t = i / (particleCount - 1);
      const basePosition = new THREE.Vector3().lerpVectors(fromPosition, toPosition, t);
      
      // Add some spiral motion to the position
      const spiralRadius = 0.4 * Math.sin(t * Math.PI * 4);
      const spiralAngle = t * Math.PI * 8;
      const spiralOffset = new THREE.Vector3(
        Math.cos(spiralAngle) * spiralRadius,
        Math.sin(spiralAngle) * spiralRadius * 0.5,
        Math.sin(spiralAngle) * spiralRadius
      );
      basePosition.add(spiralOffset);

      // Add randomness
      const randomOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3
      );
      basePosition.add(randomOffset);

      // Create velocity with more dynamic movement
      const velocity = direction.clone();
      velocity.multiplyScalar(10 + Math.random() * 6); // Faster base speed
      velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 4 + 2, // More upward bias
        (Math.random() - 0.5) * 3
      ));

      // Create particle with more vibrant colors
      const particle: Particle = {
        position: basePosition.clone(),
        velocity: velocity,
        life: 1.2,
        maxLife: 1.2 + Math.random() * 0.8, // Longer lifetime
        size: 0.08 + Math.random() * 0.15,
        color: new THREE.Color().setHSL(
          0.55 + Math.random() * 0.3, // Blue to purple hue range
          0.9 + Math.random() * 0.1, // Very high saturation
          0.6 + Math.random() * 0.4   // Bright lightness
        )
      };

      this.particles.push(particle);
    }

    // Enhanced burst effect at the origin
    this.createBurstEffect(fromPosition);
    
    // Enhanced impact effect at the target
    this.createImpactEffect(toPosition);

    // Remove old particles if we exceed the limit
    while (this.particles.length > this.maxParticles) {
      this.particles.shift();
    }
  }

  private createBurstEffect(position: THREE.Vector3): void {
    const burstCount = 25;
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * Math.PI * 0.5;
      
      const velocity = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * (4 + Math.random() * 3),
        Math.sin(elevation) * (3 + Math.random() * 2),
        Math.sin(angle) * Math.cos(elevation) * (4 + Math.random() * 3)
      );

      const particle: Particle = {
        position: position.clone(),
        velocity: velocity,
        life: 1.0,
        maxLife: 1.0,
        size: 0.12 + Math.random() * 0.08,
        color: new THREE.Color().setHSL(
          0.7 + Math.random() * 0.1, // Bright blue
          0.95,
          0.7 + Math.random() * 0.3
        )
      };

      this.particles.push(particle);
    }
  }

  private createImpactEffect(position: THREE.Vector3): void {
    const impactCount = 30;
    for (let i = 0; i < impactCount; i++) {
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 3,
        (Math.random() - 0.5) * 8
      );

      const particle: Particle = {
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3
        )),
        velocity: velocity,
        life: 1.5,
        maxLife: 1.5,
        size: 0.08 + Math.random() * 0.12,
        color: new THREE.Color().setHSL(
          0.05 + Math.random() * 0.15, // Orange to yellow-orange hue for impact
          0.95,
          0.7 + Math.random() * 0.3
        )
      };

      this.particles.push(particle);
    }
  }

  public update(): void {
    const delta = this.clock.getDelta();
    
    if (this.particles.length > 0) {
      console.log('🌟 Updating', this.particles.length, 'particles');
    }
    
    // Update all particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update position
      particle.position.add(particle.velocity.clone().multiplyScalar(delta));
      
      // Apply gravity (lighter for magical effect)
      particle.velocity.y -= 6.0 * delta;
      
      // Apply air resistance
      particle.velocity.multiplyScalar(0.99);
      
      // Add some turbulence for magical swirling effect
      const time = (particle.maxLife - particle.life) * 5;
      const turbulence = new THREE.Vector3(
        Math.sin(time + particle.position.x * 0.5) * 0.5,
        Math.cos(time + particle.position.y * 0.5) * 0.3,
        Math.sin(time + particle.position.z * 0.5) * 0.5
      );
      particle.velocity.add(turbulence.multiplyScalar(delta));
      
      // Update life
      particle.life -= delta;
      
      // Remove dead particles
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update the particle system buffers
    this.updateParticleBuffers();
  }

  private updateParticleBuffers(): void {
    const positions = new Float32Array(this.particles.length * 3);
    const colors = new Float32Array(this.particles.length * 3);
    const sizes = new Float32Array(this.particles.length);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      const i3 = i * 3;

      // Position
      positions[i3] = particle.position.x;
      positions[i3 + 1] = particle.position.y;
      positions[i3 + 2] = particle.position.z;

      // Color with life-based alpha and size-based intensity
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = Math.pow(lifeRatio, 0.5); // Slower fade for more dramatic effect
      const intensity = 0.8 + Math.sin(lifeRatio * Math.PI) * 0.2; // Pulsing effect
      
      colors[i3] = particle.color.r * alpha * intensity;
      colors[i3 + 1] = particle.color.g * alpha * intensity;
      colors[i3 + 2] = particle.color.b * alpha * intensity;

      // Size with life-based scaling and pulsing
      const sizeMultiplier = 0.5 + Math.sin(lifeRatio * Math.PI * 2) * 0.3; // Pulsing size
      sizes[i] = particle.size * alpha * sizeMultiplier;
    }

    // Update geometry attributes
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Update the particle count
    this.particleGeometry.setDrawRange(0, this.particles.length);
    
    // Mark attributes as needing update
    if (this.particleGeometry.attributes.position) {
      this.particleGeometry.attributes.position.needsUpdate = true;
    }
    if (this.particleGeometry.attributes.color) {
      this.particleGeometry.attributes.color.needsUpdate = true;
    }
    if (this.particleGeometry.attributes.size) {
      this.particleGeometry.attributes.size.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.scene.remove(this.particleSystem);
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
  }
}
