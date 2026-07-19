import { CommentsManager } from '../comments-manager';

describe('CommentsManager', () => {
  let commentsManager: CommentsManager;

  beforeEach(() => {
    commentsManager = new CommentsManager();
  });

  it('should add comment', () => {
    commentsManager.addComment('cell-1', 'Test comment');
    const comments = commentsManager.getComments('cell-1');
    expect(comments.length).toBe(1);
    expect(comments[0].text).toBe('Test comment');
  });

  it('should remove comment', () => {
    const id = commentsManager.addComment('cell-1', 'Test');
    const removed = commentsManager.removeComment(id);
    expect(removed).toBe(true);
    expect(commentsManager.getComments('cell-1').length).toBe(0);
  });

  it('should resolve comment', () => {
    const id = commentsManager.addComment('cell-1', 'Test');
    commentsManager.resolveComment(id);
    const comments = commentsManager.getComments('cell-1');
    expect(comments[0].resolved).toBe(true);
  });

  it('should get comments for cell', () => {
    commentsManager.addComment('cell-1', 'Comment 1');
    commentsManager.addComment('cell-1', 'Comment 2');
    commentsManager.addComment('cell-2', 'Comment 3');
    
    expect(commentsManager.getComments('cell-1').length).toBe(2);
    expect(commentsManager.getComments('cell-2').length).toBe(1);
  });
});
