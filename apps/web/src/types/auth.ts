export interface User {
  id: string
  firstName: string
  lastName: string
  phoneNumber: string
  email?: string
  avatarUrl?: string
  createdAt: string
  lastLogin: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface SignupData {
  firstName: string
  lastName: string
  phoneNumber: string
  email?: string
  password: string
}

export interface LoginData {
  identifier: string
  password: string
}
