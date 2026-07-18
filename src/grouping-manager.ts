/**
 * Grouping Manager
 * Uses maxGraph's native grouping capabilities
 * No reinventing the wheel - leveraging library's built-in features
 */

export class GroupingManager {
  constructor(private graph: any) {}

  /**
   * Group selected cells into a container
   * maxGraph handles all the grouping logic natively
   */
  groupCells(cells: any[], groupLabel: string = 'Group'): any {
    if (cells.length < 2) {
      console.warn('Need at least 2 cells to group');
      return null;
    }

    try {
      // maxGraph's native group() method
      const group = this.graph.groupCells(null, 0, groupLabel);
      return group;
    } catch (err) {
      console.error('Grouping failed:', err);
      return null;
    }
  }

  /**
   * Ungroup cells - dissolve group container
   * maxGraph handles ungrouping natively
   */
  ungroupCells(cells: any[]): any[] {
    if (cells.length === 0) return [];

    try {
      // maxGraph's native ungroupCells() method
      const result = this.graph.ungroupCells(cells);
      return result || cells;
    } catch (err) {
      console.error('Ungrouping failed:', err);
      return cells;
    }
  }

  /**
   * Check if cell is a group
   */
  isGroup(cell: any): boolean {
    if (!cell) return false;
    // maxGraph marks groups with isVertex() and has children
    return cell.isVertex && cell.isVertex() && this.graph.model.getChildCount(cell) > 0;
  }

  /**
   * Get group members (child cells)
   */
  getGroupMembers(groupCell: any): any[] {
    if (!groupCell) return [];

    const children: any[] = [];
    const childCount = this.graph.model.getChildCount(groupCell);

    for (let i = 0; i < childCount; i++) {
      const child = this.graph.model.getChildAt(groupCell, i);
      if (child && child.isVertex && child.isVertex()) {
        children.push(child);
      }
    }

    return children;
  }

  /**
   * Get parent group of a cell
   */
  getParentGroup(cell: any): any {
    if (!cell) return null;
    const parent = cell.parent;
    return parent && this.isGroup(parent) ? parent : null;
  }

  /**
   * Edit group label
   */
  editGroupLabel(groupCell: any, newLabel: string): void {
    if (!groupCell) return;
    this.graph.model.setValue(groupCell, newLabel);
  }

  /**
   * Collapse group (hide children)
   */
  collapseGroup(groupCell: any): void {
    if (!groupCell || !this.isGroup(groupCell)) return;

    // maxGraph's native toggleCollapsed() or setCollapsed()
    this.graph.model.setCollapsed(groupCell, true);
  }

  /**
   * Expand group (show children)
   */
  expandGroup(groupCell: any): void {
    if (!groupCell || !this.isGroup(groupCell)) return;

    this.graph.model.setCollapsed(groupCell, false);
  }

  /**
   * Toggle group collapsed state
   */
  toggleGroupCollapsed(groupCell: any): void {
    if (!groupCell || !this.isGroup(groupCell)) return;

    const isCollapsed = groupCell.collapsed || false;
    this.graph.model.setCollapsed(groupCell, !isCollapsed);
  }

  /**
   * Delete group and keep members
   */
  deleteGroupKeepMembers(groupCell: any): void {
    if (!groupCell) return;

    // Ungroup first to keep members, then remove group container
    this.ungroupCells([groupCell]);
  }
}
