/**
 * Animation Manager - Animate shapes
 */
export interface Animation {
  id: string;
  cellId: string;
  type: 'fade' | 'slide' | 'pulse' | 'bounce';
  duration: number;
  delay: number;
  loop: boolean;
}

export class AnimationManager {
  private animations: Map<string, Animation> = new Map();

  constructor() {}

  addAnimation(cellId: string, type: string, duration: number = 1000): string {
    const id = `anim-${Date.now()}`;
    const animation: Animation = {
      id,
      cellId,
      type: type as any,
      duration,
      delay: 0,
      loop: false,
    };

    this.animations.set(id, animation);
    return id;
  }

  getAnimations(cellId: string): Animation[] {
    return Array.from(this.animations.values()).filter((a) => a.cellId === cellId);
  }

  removeAnimation(id: string): boolean {
    return this.animations.delete(id);
  }

  removeAllAnimations(cellId: string): void {
    for (const [id, anim] of this.animations) {
      if (anim.cellId === cellId) {
        this.animations.delete(id);
      }
    }
  }

  getAllAnimations(): Animation[] {
    return Array.from(this.animations.values());
  }
}
