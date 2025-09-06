import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  attackType: 'spell' | 'punch' | 'melee' | 'range'; // Add attack type
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
      color: 0xffffff, // White base color to allow vertex colors to show through
      size: 0.15,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
      alphaTest: 0.1,
      depthWrite: false, // Prevent depth buffer issues
      depthTest: true
    });

    // Create particle system
    this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.particleSystem.frustumCulled = false; // Prevent culling issues
    this.particleSystem.renderOrder = 999; // Render after most other objects
    this.scene.add(this.particleSystem);

    
    // Initialize buffers with empty data
    this.updateParticleBuffers();
  }

  public castSpell(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('🎆 ParticleSystem.castSpell called!', {
      from: fromPosition,
      to: toPosition,
      currentParticleCount: this.particles.length,
      sceneChildren: this.scene.children.length,
      particleSystemInScene: this.scene.children.includes(this.particleSystem)
    });
    
    this.createSpellEffect(fromPosition, toPosition, false); // false = local player
  }

  public castSpellFromNetwork(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('🌐 ParticleSystem.castSpellFromNetwork called!', {
      from: fromPosition,
      to: toPosition,
      currentParticleCount: this.particles.length,
      particleSystemInScene: this.scene.children.includes(this.particleSystem)
    });
    
    this.createSpellEffect(fromPosition, toPosition, true); // true = from other player
  }

  // Punch Attack - close range with impact burst
  public castPunch(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('👊 ParticleSystem.castPunch called!', {
      from: fromPosition,
      to: toPosition
    });
    
    this.createPunchEffect(fromPosition, toPosition, false); // false = local player
  }

  public castPunchFromNetwork(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('🌐 ParticleSystem.castPunchFromNetwork called!', {
      from: fromPosition,
      to: toPosition
    });
    
    this.createPunchEffect(fromPosition, toPosition, true); // true = from other player
  }

  // Melee Attack - sword slash effect
  public castMelee(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('⚔️ ParticleSystem.castMelee called!', {
      from: fromPosition,
      to: toPosition
    });
    
    this.createMeleeEffect(fromPosition, toPosition, false); // false = local player
  }

  public castMeleeFromNetwork(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('🌐 ParticleSystem.castMeleeFromNetwork called!', {
      from: fromPosition,
      to: toPosition
    });
    
    this.createMeleeEffect(fromPosition, toPosition, true); // true = from other player
  }

  // Range Attack - arrow projectile
  public castRange(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('🏹 ParticleSystem.castRange called!', {
      from: fromPosition,
      to: toPosition
    });
    
    this.createRangeEffect(fromPosition, toPosition, false); // false = local player
  }

  public castRangeFromNetwork(fromPosition: THREE.Vector3, toPosition: THREE.Vector3): void {
    console.log('🌐 ParticleSystem.castRangeFromNetwork called!', {
      from: fromPosition,
      to: toPosition
    });
    
    this.createRangeEffect(fromPosition, toPosition, true); // true = from other player
  }

  private createSpellEffect(fromPosition: THREE.Vector3, toPosition: THREE.Vector3, isFromOtherPlayer: boolean): void {
    console.log('🔮 createSpellEffect called!', {
      from: fromPosition,
      to: toPosition,
      isFromOtherPlayer,
      particleSystemInScene: this.scene.children.includes(this.particleSystem)
    });
    
    // Ensure particle system is in the scene
    if (!this.scene.children.includes(this.particleSystem)) {
            this.scene.add(this.particleSystem);
    }
    
    const direction = new THREE.Vector3().subVectors(toPosition, fromPosition).normalize();
    const distance = fromPosition.distanceTo(toPosition);
    
    // Create multiple particles for the spell effect
    const particleCount = Math.min(40, Math.floor(distance * 3) + 15);
        
    // Different colors for local vs other players
    const baseHue = isFromOtherPlayer ? 0.05 : 0.55; // Orange for others, blue for local
    const hueRange = isFromOtherPlayer ? 0.15 : 0.3; // Narrower range for others
    
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

      // Create particle with dynamic colors based on source
      const particle: Particle = {
        position: basePosition.clone(),
        velocity: velocity,
        life: 1.2,
        maxLife: 1.2 + Math.random() * 0.8, // Longer lifetime
        size: 0.08 + Math.random() * 0.15,
        color: new THREE.Color().setHSL(
          baseHue + Math.random() * hueRange, // Different colors for local vs other players
          0.9 + Math.random() * 0.1, // Very high saturation
          0.6 + Math.random() * 0.4   // Bright lightness
        ),
        attackType: 'spell'
      };

      this.particles.push(particle);
    }

    // Enhanced burst effect at the origin
    this.createBurstEffect(fromPosition, isFromOtherPlayer);
    
    // Enhanced impact effect at the target
    this.createImpactEffect(toPosition, isFromOtherPlayer);

    // Remove old particles if we exceed the limit
    while (this.particles.length > this.maxParticles) {
      this.particles.shift();
    }
  }

  private createBurstEffect(position: THREE.Vector3, isFromOtherPlayer: boolean = false): void {
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
          isFromOtherPlayer ? 0.05 + Math.random() * 0.1 : 0.7 + Math.random() * 0.1, // Orange for others, blue for local
          0.95,
          0.7 + Math.random() * 0.3
        ),
        attackType: 'spell'
      };

      this.particles.push(particle);
    }
  }

  private createImpactEffect(position: THREE.Vector3, isFromOtherPlayer: boolean = false): void {
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
          isFromOtherPlayer ? 0.02 + Math.random() * 0.08 : 0.05 + Math.random() * 0.15, // Redder for others, orange for local
          0.95,
          0.7 + Math.random() * 0.3
        ),
        attackType: 'spell'
      };

      this.particles.push(particle);
    }
  }

  // Punch Effect - Short range, small explosive impact
  private createPunchEffect(fromPosition: THREE.Vector3, toPosition: THREE.Vector3, isFromOtherPlayer: boolean): void {
    console.log('👊 createPunchEffect called!', { from: fromPosition, to: toPosition, isFromOtherPlayer });
    
    // Ensure particle system is in the scene
    if (!this.scene.children.includes(this.particleSystem)) {
      this.scene.add(this.particleSystem);
    }
    
    // Punch is very short range - limit distance for close combat
    const direction = new THREE.Vector3().subVectors(toPosition, fromPosition).normalize();
    const punchRange = Math.min(1.5, fromPosition.distanceTo(toPosition)); // Max 1.5 units range - much closer
    const actualTarget = fromPosition.clone().add(direction.clone().multiplyScalar(punchRange));
    
    // Punch colors - yellow for energy
    const baseHue = 0.15; // Yellow for both local and others
    
    // Create fewer, closer impact particles
    const particleCount = 8; // Reduced from 15
    for (let i = 0; i < particleCount; i++) {
      const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.2; // Reduced spread - 20 degrees
      const spreadDirection = direction.clone();
      spreadDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
      
      const velocity = spreadDirection.clone().multiplyScalar(4 + Math.random() * 2); // Slower particles
      velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * 1,
        Math.random() * 1.5 + 0.5,
        (Math.random() - 0.5) * 1
      ));

      const particle: Particle = {
        position: fromPosition.clone(),
        velocity: velocity,
        life: 0.4,
        maxLife: 0.4 + Math.random() * 0.2,
        size: 0.08 + Math.random() * 0.06,
        color: new THREE.Color().setHSL(
          baseHue + Math.random() * 0.05,
          0.9 + Math.random() * 0.1,
          0.7 + Math.random() * 0.3
        ),
        attackType: 'punch'
      };

      this.particles.push(particle);
    }

    // Smaller impact burst at target
    this.createPunchImpact(actualTarget, isFromOtherPlayer);
    
    // Remove old particles if we exceed the limit
    while (this.particles.length > this.maxParticles) {
      this.particles.shift();
    }
  }

  private createPunchImpact(position: THREE.Vector3, isFromOtherPlayer: boolean): void {
    const impactCount = 12; // Reduced from 25 for smaller explosion
    for (let i = 0; i < impactCount; i++) {
      const angle = (i / impactCount) * Math.PI * 2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * (2 + Math.random() * 1.5), // Reduced velocity for smaller explosion
        Math.random() * 2 + 1,
        Math.sin(angle) * (2 + Math.random() * 1.5)
      );

      const particle: Particle = {
        position: position.clone(),
        velocity: velocity,
        life: 0.5,
        maxLife: 0.5,
        size: 0.08 + Math.random() * 0.06,
        color: new THREE.Color().setHSL(
          0.15, // Yellow for both local and others
          0.95,
          0.8 + Math.random() * 0.2
        ),
        attackType: 'punch'
      };

      this.particles.push(particle);
    }
  }

  // Melee Effect - Sword slash with tighter arc motion
  private createMeleeEffect(fromPosition: THREE.Vector3, toPosition: THREE.Vector3, isFromOtherPlayer: boolean): void {
    console.log('⚔️ createMeleeEffect called!', { from: fromPosition, to: toPosition, isFromOtherPlayer });
    
    // Ensure particle system is in the scene
    if (!this.scene.children.includes(this.particleSystem)) {
      this.scene.add(this.particleSystem);
    }
    
    const direction = new THREE.Vector3().subVectors(toPosition, fromPosition).normalize();
    const distance = Math.min(2.5, fromPosition.distanceTo(toPosition)); // Reduced range - half of original 5
    
    // Melee colors - silver/white for blade
    const baseHue = 0.0; // White/silver for both local and others
    
    // Create tighter slash arc effect
    const particleCount = 15; // Reduced from 20
    for (let i = 0; i < particleCount; i++) {
      const t = i / (particleCount - 1);
      
      // Create smaller arc motion - particles follow a tighter curved slash path
      const arcAngle = (t - 0.5) * Math.PI * 0.15; // Reduced from 0.4 to 0.15 for tighter arc
      const arcDirection = direction.clone();
      arcDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), arcAngle);
      
      const arcPosition = fromPosition.clone().add(arcDirection.clone().multiplyScalar(distance * t));
      
      // Add smaller height variation for slash effect - closer to character
      arcPosition.y += Math.sin(t * Math.PI) * 0.2; // Reduced from 0.5 to 0.2
      
      const velocity = arcDirection.clone().multiplyScalar(3 + Math.random() * 2); // Reduced velocity
      velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 1,
        (Math.random() - 0.5) * 0.5
      ));

      const particle: Particle = {
        position: arcPosition,
        velocity: velocity,
        life: 0.6,
        maxLife: 0.6 + Math.random() * 0.3,
        size: 0.05 + Math.random() * 0.06,
        color: new THREE.Color().setHSL(
          baseHue + Math.random() * 0.05,
          0.1, // Low saturation for metallic look
          0.8 + Math.random() * 0.2
        ),
        attackType: 'melee'
      };

      this.particles.push(particle);
    }

    // Smaller sparks at impact point
    this.createMeleeSparks(toPosition, isFromOtherPlayer);
    
    // Remove old particles if we exceed the limit
    while (this.particles.length > this.maxParticles) {
      this.particles.shift();
    }
  }

  private createMeleeSparks(position: THREE.Vector3, isFromOtherPlayer: boolean): void {
    const sparkCount = 10; // Reduced from 15
    for (let i = 0; i < sparkCount; i++) {
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3, // Reduced spread
        Math.random() * 3 + 0.5,
        (Math.random() - 0.5) * 3
      );

      const particle: Particle = {
        position: position.clone(),
        velocity: velocity,
        life: 0.7,
        maxLife: 0.7,
        size: 0.04 + Math.random() * 0.04,
        color: new THREE.Color().setHSL(
          0.0, // White/silver for both local and others
          0.1,
          0.9 + Math.random() * 0.1
        ),
        attackType: 'melee'
      };

      this.particles.push(particle);
    }
  }

  // Range Effect - Arrow trajectory with trail
  private createRangeEffect(fromPosition: THREE.Vector3, toPosition: THREE.Vector3, isFromOtherPlayer: boolean): void {
    console.log('🏹 createRangeEffect called!', { from: fromPosition, to: toPosition, isFromOtherPlayer });
    
    // Ensure particle system is in the scene
    if (!this.scene.children.includes(this.particleSystem)) {
      this.scene.add(this.particleSystem);
    }
    
    const direction = new THREE.Vector3().subVectors(toPosition, fromPosition).normalize();
    const distance = fromPosition.distanceTo(toPosition);
    
    // Range colors - black for arrow
    const baseHue = 0.0; // Black/dark for both local and others
    
    // Create arrow trail effect - particles along the trajectory
    const particleCount = Math.min(30, Math.floor(distance * 2) + 10);
    for (let i = 0; i < particleCount; i++) {
      const t = i / (particleCount - 1);
      const trailPosition = fromPosition.clone().lerp(toPosition, t);
      
      // Add slight gravity arc to trajectory
      const gravity = 0.5 * t * t; // Parabolic arc
      trailPosition.y -= gravity;
      
      // Small random offset for trail spread
      trailPosition.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      ));

      const velocity = direction.clone().multiplyScalar(3 + Math.random() * 2);
      velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 1,
        (Math.random() - 0.5) * 0.5
      ));

      const particle: Particle = {
        position: trailPosition,
        velocity: velocity,
        life: 1.0,
        maxLife: 1.0 + Math.random() * 0.5,
        size: 0.04 + Math.random() * 0.06,
        color: new THREE.Color().setHSL(
          baseHue,
          0.0, // No saturation for black
          0.1 + Math.random() * 0.2 // Very dark
        ),
        attackType: 'range'
      };

      this.particles.push(particle);
    }

    // Arrow impact effect
    this.createArrowImpact(toPosition, isFromOtherPlayer);
    
    // Remove old particles if we exceed the limit
    while (this.particles.length > this.maxParticles) {
      this.particles.shift();
    }
  }

  private createArrowImpact(position: THREE.Vector3, isFromOtherPlayer: boolean): void {
    const impactCount = 12;
    for (let i = 0; i < impactCount; i++) {
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );

      const particle: Particle = {
        position: position.clone(),
        velocity: velocity,
        life: 0.6,
        maxLife: 0.6,
        size: 0.08 + Math.random() * 0.06,
        color: new THREE.Color().setHSL(
          0.0, // Black for both local and others
          0.0, // No saturation for black
          0.1 + Math.random() * 0.2 // Very dark
        ),
        attackType: 'range'
      };

      this.particles.push(particle);
    }
  }

  public update(): void {
    const delta = this.clock.getDelta();
    
    // Clamp delta to prevent huge jumps
    const clampedDelta = Math.min(delta, 1/30); // Max 30fps to prevent big jumps
    
    // Log particle count occasionally for debugging
    if (this.particles.length > 0 && Math.random() < 0.01) { // 1% chance to log
      console.log('🌟 Particle system update:', {
        particleCount: this.particles.length,
        delta: clampedDelta,
        particleSystemInScene: this.scene.children.includes(this.particleSystem)
      });
    }
    
    // Ensure particle system is still in scene
    if (!this.scene.children.includes(this.particleSystem)) {
            this.scene.add(this.particleSystem);
    }
    
    // Update all particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update position
      particle.position.add(particle.velocity.clone().multiplyScalar(clampedDelta));
      
      // Apply gravity (lighter for magical effect)
      particle.velocity.y -= 6.0 * clampedDelta;
      
      // Apply air resistance
      particle.velocity.multiplyScalar(0.99);
      
      // Add some turbulence for magical swirling effect
      const time = (particle.maxLife - particle.life) * 5;
      const turbulence = new THREE.Vector3(
        Math.sin(time + particle.position.x * 0.5) * 0.5,
        Math.cos(time + particle.position.y * 0.5) * 0.3,
        Math.sin(time + particle.position.z * 0.5) * 0.5
      );
      particle.velocity.add(turbulence.multiplyScalar(clampedDelta));
      
      // Update life
      particle.life -= clampedDelta;
      
      // Remove dead particles
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Always update the particle system buffers, even if no particles
    this.updateParticleBuffers();
  }

  private updateParticleBuffers(): void {
    const particleCount = this.particles.length;
    
    // Handle empty particle array
    if (particleCount === 0) {
      // Set empty buffers to avoid rendering issues
      this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 3));
      this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(0), 1));
      this.particleGeometry.setDrawRange(0, 0);
      return;
    }

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
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
      
      // Get base color based on attack type
      let baseColor: THREE.Color;
      switch (particle.attackType) {
        case 'spell':
          baseColor = new THREE.Color(0x4488ff); // Blue
          break;
        case 'punch':
          baseColor = new THREE.Color(0xffdd00); // Yellow
          break;
        case 'melee':
          baseColor = new THREE.Color(0xcccccc); // Silver
          break;
        case 'range':
          baseColor = new THREE.Color(0x333333); // Dark gray
          break;
        default:
          baseColor = new THREE.Color(0xffffff); // White fallback
      }
      
      colors[i3] = baseColor.r * alpha * intensity;
      colors[i3 + 1] = baseColor.g * alpha * intensity;
      colors[i3 + 2] = baseColor.b * alpha * intensity;

      // Size with life-based scaling and pulsing
      const sizeMultiplier = 0.5 + Math.sin(lifeRatio * Math.PI * 2) * 0.3; // Pulsing size
      sizes[i] = particle.size * alpha * sizeMultiplier;
    }

    // Update geometry attributes
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Update the particle count
    this.particleGeometry.setDrawRange(0, particleCount);
    
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

  // Method to reinitialize if needed (for floor changes, etc.)
  public reinitialize(): void {
        this.dispose();
    this.initializeParticleSystem();
  }

  // Method to check if particle system is properly set up
  public isInitialized(): boolean {
    return this.scene.children.includes(this.particleSystem);
  }
}
