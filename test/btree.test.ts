import { describe, expect, it } from 'vitest';
import { BTreeIndex, type KeyType } from '../src/data/btree.js';

describe('BTreeIndex', () => {
  const createTestTree = (order = 3, unique = false) => {
    return new BTreeIndex({ order, unique });
  };

  describe('insertion', () => {
    it('inserts into empty tree', () => {
      const tree = createTestTree();
      tree.insert(5, 'doc1');
      expect(tree.search(5)).toEqual(['doc1']);
    });

    it('handles duplicate keys when not unique', () => {
      const tree = createTestTree(3, false);
      tree.insert(5, 'doc1');
      tree.insert(5, 'doc2');
      expect(tree.search(5)).toEqual(['doc1', 'doc2']);
    });

    it('prevents duplicate keys when unique', () => {
      const tree = createTestTree(3, true);
      tree.insert(5, 'doc1');
      expect(() => tree.insert(5, 'doc2')).toThrowError(
        "Duplicate key '5' not allowed in unique index"
      );
    });

    it('splits root when full', () => {
      const tree = createTestTree(2); // Small order for testing
      tree.insert(1, 'doc1');
      tree.insert(2, 'doc2');
      tree.insert(3, 'doc3'); // Should cause split
      expect(tree.search(1)).toEqual(['doc1']);
      expect(tree.search(2)).toEqual(['doc2']);
      expect(tree.search(3)).toEqual(['doc3']);
    });

    it('handles multiple data types', () => {
      const tree = createTestTree();
      tree.insert(42, 'numDoc');
      tree.insert('42', 'strDoc');
      tree.insert(new Date(2023, 1, 1), 'dateDoc');
      expect(tree.search(42)).toEqual(['numDoc']);
      expect(tree.search('42')).toEqual(['strDoc']);
      expect(tree.search(new Date(2023, 1, 1))).toEqual(['dateDoc']);
    });
  });

  describe('deletion', () => {
    it('removes key from leaf node', () => {
      const tree = createTestTree();
      tree.insert(5, 'doc1');
      tree.delete(5, 'doc1');
      expect(tree.search(5)).toEqual([]);
    });

    it('removes specific doc from multi-doc key', () => {
      const tree = createTestTree();
      tree.insert(5, 'doc1');
      tree.insert(5, 'doc2');
      tree.delete(5, 'doc1');
      expect(tree.search(5)).toEqual(['doc2']);
    });

    it('handles delete from internal node', () => {
      const tree = createTestTree(2); // Small order to force tree structure
      for (let i = 1; i <= 5; i++) {
        tree.insert(i, `doc${i}`);
      }
      tree.delete(3, 'doc3');
      expect(tree.search(3)).toEqual([]);
      // Verify structure remains intact
      expect(tree.search(1)).toEqual(['doc1']);
      expect(tree.search(2)).toEqual(['doc2']);
      expect(tree.search(4)).toEqual(['doc4']);
      expect(tree.search(5)).toEqual(['doc5']);
    });

    it('merges nodes when necessary', () => {
      const tree = createTestTree(2);
      tree.insert(1, 'doc1');
      tree.insert(2, 'doc2');
      tree.insert(3, 'doc3');
      tree.insert(4, 'doc4');
      tree.delete(4, 'doc4');
      tree.delete(3, 'doc3');
      // Verify structure remains valid
      expect(tree.search(1)).toEqual(['doc1']);
      expect(tree.search(2)).toEqual(['doc2']);
      expect(tree.search(3)).toEqual([]);
    });
  });

  describe('search', () => {
    it('finds existing keys', () => {
      const tree = createTestTree();
      tree.insert(5, 'doc1');
      tree.insert(10, 'doc2');
      expect(tree.search(5)).toEqual(['doc1']);
      expect(tree.search(10)).toEqual(['doc2']);
    });

    it('returns empty array for missing keys', () => {
      const tree = createTestTree();
      expect(tree.search(99)).toEqual([]);
    });

    it('searches with custom key parser', () => {
      const tree = new BTreeIndex({
        keyParser: (key: KeyType) => String(key).toLowerCase(),
      });
      tree.insert('ABC', 'doc1');
      expect(tree.search('abc')).toEqual(['doc1']);
    });
  });

  describe('range search', () => {
    it('finds keys in range', () => {
      const tree = createTestTree();
      for (let i = 1; i <= 10; i++) {
        tree.insert(i, `doc${i}`);
      }
      const results = tree.searchRange(3, 7);
      expect(results).toEqual([
        'doc3', 'doc4', 'doc5', 'doc6', 'doc7'
      ]);
    });

    it('handles exclusive bounds', () => {
      const tree = createTestTree();
      tree.insert(1, 'doc1');
      tree.insert(2, 'doc2');
      tree.insert(3, 'doc3');
      expect(tree.searchRange(2, 2)).toEqual(['doc2']);
    });

    it('returns empty for invalid range', () => {
      const tree = createTestTree();
      tree.insert(5, 'doc1');
      expect(tree.searchRange(10, 20)).toEqual([]);
    });

    it('handles different data types', () => {
      const tree = createTestTree();
      const date1 = new Date(2023, 1, 1).getTime();
      const date2 = new Date(2023, 1, 5).getTime();
      const date3 = new Date(2023, 1, 10).getTime();
      
      tree.insert(date1, 'doc1');
      tree.insert(date2, 'doc2');
      tree.insert(date3, 'doc3');
      
      const start = new Date(2023, 1, 2).getTime();
      const end = new Date(2023, 1, 8).getTime();
      const results = tree.searchRange(start, end);
      
      expect(results).toEqual(['doc2']);
    });
  });

  describe('edge cases', () => {
    it('handles deleting from empty tree', () => {
      const tree = createTestTree();
      expect(() => tree.delete(1, 'doc1')).not.toThrow();
    });

    it('handles deleting non-existent doc', () => {
      const tree = createTestTree();
      tree.insert(1, 'doc1');
      tree.delete(1, 'non-existent');
      expect(tree.search(1)).toEqual(['doc1']);
    });

    it('maintains structure after compaction', () => {
      const tree = createTestTree(2);
      for (let i = 1; i <= 5; i++) {
        tree.insert(i, `doc${i}`);
      }
      for (let i = 1; i <= 5; i++) {
        tree.delete(i, `doc${i}`);
      }
      tree.compact();
      // Verify tree is empty but valid
      expect(tree.search(1)).toEqual([]);
    });

    it('handles keys in reverse order', () => {
      const tree = createTestTree();
      tree.insert(10, 'doc10');
      tree.insert(5, 'doc5');
      tree.insert(1, 'doc1');
      expect(tree.search(1)).toEqual(['doc1']);
      expect(tree.search(5)).toEqual(['doc5']);
      expect(tree.search(10)).toEqual(['doc10']);
    });
  });
});