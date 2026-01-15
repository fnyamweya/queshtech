export interface AdminUser {
  id: string
  username: string
  email: string
  role: 'admin' | 'super_admin'
  firstName: string
  lastName: string
  createdAt: string
  lastLogin: string
}

export interface AdminLoginData {
  email: string
  password: string
  twoFactorCode?: string
}
