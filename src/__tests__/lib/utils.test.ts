import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('cn() – class name merger', () => {
    it('should merge class names', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      expect(cn('base', isActive && 'active')).toContain('active')
    })

    it('should handle false/undefined/null values', () => {
      expect(cn('base', false, null, undefined, 'end')).toBe('base end')
    })

    it('should resolve tailwind conflicts (last wins)', () => {
      const result = cn('text-red-500', 'text-blue-500')
      expect(result).toBe('text-blue-500')
    })

    it('should handle empty arguments', () => {
      expect(cn()).toBe('')
    })

    it('should handle array inputs', () => {
      expect(cn(['a', 'b'])).toContain('a')
      expect(cn(['a', 'b'])).toContain('b')
    })
  })
})
