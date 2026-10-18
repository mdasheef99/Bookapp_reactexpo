import { NOTE_TAG_CONFIG, NoteTag } from '../notesService';

describe('notesService', () => {
  describe('NOTE_TAG_CONFIG', () => {
    it('has all five tag types with required properties', () => {
      const tags: NoteTag[] = ['quote', 'reflect', 'distill', 'apply', 'question'];
      tags.forEach((tag) => {
        expect(NOTE_TAG_CONFIG[tag]).toBeDefined();
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('label');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('icon');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('color');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('bgColor');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('description');
      });
    });
  });
});
