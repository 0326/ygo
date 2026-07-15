import { useEffect, useState } from 'react'
import type { AuthUser } from '../types'
import { getUser, subscribe } from '../services/auth'

export function useAuth(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(getUser())
  useEffect(() => subscribe(setUser), [])
  return user
}
