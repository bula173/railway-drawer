/**
 * Comments Manager - Add notes to shapes
 */
export interface Comment {
  id: string;
  cellId: string;
  text: string;
  author?: string;
  timestamp: number;
  resolved?: boolean;
}

export class CommentsManager {
  private comments: Map<string, Comment[]> = new Map();

  constructor() {}

  addComment(cellId: string, text: string, author?: string): string {
    const id = `comment-${Date.now()}`;
    const comment: Comment = {
      id,
      cellId,
      text,
      author,
      timestamp: Date.now(),
      resolved: false,
    };

    if (!this.comments.has(cellId)) {
      this.comments.set(cellId, []);
    }
    this.comments.get(cellId)!.push(comment);
    return id;
  }

  getComments(cellId: string): Comment[] {
    return this.comments.get(cellId) || [];
  }

  removeComment(commentId: string): boolean {
    for (const [, comments] of this.comments) {
      const index = comments.findIndex((c) => c.id === commentId);
      if (index !== -1) {
        comments.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  resolveComment(commentId: string): boolean {
    for (const [, comments] of this.comments) {
      const comment = comments.find((c) => c.id === commentId);
      if (comment) {
        comment.resolved = true;
        return true;
      }
    }
    return false;
  }
}
