import { AnimationManager } from '../animation-manager';

describe('AnimationManager', () => {
  let animationManager: AnimationManager;

  beforeEach(() => {
    animationManager = new AnimationManager();
  });

  it('should add animation', () => {
    animationManager.addAnimation('cell-1', 'fade', 1000);
    const animations = animationManager.getAnimations('cell-1');
    expect(animations.length).toBe(1);
  });

  it('should remove animation', () => {
    const id = animationManager.addAnimation('cell-1', 'fade');
    const removed = animationManager.removeAnimation(id);
    expect(removed).toBe(true);
  });

  it('should get animations for cell', () => {
    animationManager.addAnimation('cell-1', 'fade');
    animationManager.addAnimation('cell-1', 'slide');
    animationManager.addAnimation('cell-2', 'bounce');
    
    expect(animationManager.getAnimations('cell-1').length).toBe(2);
    expect(animationManager.getAnimations('cell-2').length).toBe(1);
  });

  it('should remove all animations for cell', () => {
    animationManager.addAnimation('cell-1', 'fade');
    animationManager.addAnimation('cell-1', 'slide');
    animationManager.removeAllAnimations('cell-1');
    
    expect(animationManager.getAnimations('cell-1').length).toBe(0);
  });

  it('should get all animations', () => {
    animationManager.addAnimation('cell-1', 'fade');
    animationManager.addAnimation('cell-2', 'bounce');
    const all = animationManager.getAllAnimations();
    expect(all.length).toBe(2);
  });
});
