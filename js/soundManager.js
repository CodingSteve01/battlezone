// soundManager.js
export class SoundManager {
    constructor() {
      this.sounds = new Map();
      this.volume = 0.5;
      this.muted = false;
  
      // Initialize all game sounds
      this.initializeSounds();
    }
  
    initializeSounds() {
      // Main sound effects
      this.createSound('shoot', [
        { frequency: 180, type: 'square', duration: 0.1, gain: 0.3 },
        { frequency: 150, type: 'square', duration: 0.1, gain: 0.2, delay: 0.05 }
      ]);
  
      this.createSound('explosion', [
        { frequency: 100, type: 'sawtooth', duration: 0.3, gain: 0.3 },
        { frequency: 80, type: 'square', duration: 0.2, gain: 0.2, delay: 0.1 },
        { frequency: 60, type: 'square', duration: 0.3, gain: 0.2, delay: 0.2 }
      ]);
  
      this.createSound('hit', [
        { frequency: 200, type: 'square', duration: 0.1, gain: 0.2 },
        { frequency: 150, type: 'sine', duration: 0.1, gain: 0.15, delay: 0.05 }
      ]);
  
      this.createSound('powerUpCollect', [
        { frequency: 440, type: 'sine', duration: 0.1, gain: 0.2 },
        { frequency: 660, type: 'sine', duration: 0.1, gain: 0.2, delay: 0.1 }
      ]);
  
      this.createSound('powerUpDrop', [
        { frequency: 660, type: 'sine', duration: 0.1, gain: 0.2 },
        { frequency: 440, type: 'sine', duration: 0.1, gain: 0.2, delay: 0.1 }
      ]);
  
      this.createSound('vehicleImpact', [
        { frequency: 120, type: 'square', duration: 0.15, gain: 0.3 },
        { frequency: 100, type: 'square', duration: 0.2, gain: 0.2, delay: 0.05 }
      ]);
  
      this.createSound('enterVehicle', [
        { frequency: 300, type: 'sine', duration: 0.15, gain: 0.2 },
        { frequency: 400, type: 'sine', duration: 0.1, gain: 0.15, delay: 0.15 }
      ]);
  
      this.createSound('exitVehicle', [
        { frequency: 400, type: 'sine', duration: 0.15, gain: 0.2 },
        { frequency: 300, type: 'sine', duration: 0.1, gain: 0.15, delay: 0.15 }
      ]);
  
      this.createSound('switchSeat', [
        { frequency: 350, type: 'sine', duration: 0.1, gain: 0.2 },
        { frequency: 350, type: 'sine', duration: 0.1, gain: 0.15, delay: 0.1 }
      ]);
  
      this.createSound('enemyShoot', [
        { frequency: 160, type: 'square', duration: 0.1, gain: 0.25 },
        { frequency: 130, type: 'square', duration: 0.1, gain: 0.15, delay: 0.05 }
      ]);
    }
  
    createSound(name, parameters) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      const generateSound = (params) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = params.type;
        oscillator.frequency.setValueAtTime(params.frequency, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(params.gain * this.volume, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + params.duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        return { oscillator, gainNode, params };
      };
  
      this.sounds.set(name, {
        parameters,
        generate: () => {
          if (this.muted) return;
          
          const nodes = parameters.map(params => {
            const sound = generateSound(params);
            setTimeout(() => {
              sound.oscillator.start(audioContext.currentTime);
              sound.oscillator.stop(audioContext.currentTime + params.duration);
            }, (params.delay || 0) * 1000);
            return sound;
          });
  
          return nodes;
        }
      });
    }
  
    playSound(name) {
      if (this.muted) return;
      
      const sound = this.sounds.get(name);
      if (sound) {
        sound.generate();
      }
    }
  
    setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, volume));
    }
  
    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }
  
    isMuted() {
      return this.muted;
    }
  }