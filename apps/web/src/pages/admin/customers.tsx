import { useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MagnifyingGlass, Eye } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useLocation } from 'wouter'
import { getCustomerDisplayName, useCustomers } from '@/hooks/use-customers'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function AdminCustomersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'banned'>('all')

  const { accessToken, isAuthenticated } = useAdminAuth()
  const [, setLocation] = useLocation()

  const { customers, isLoading, error, refresh, inviteCustomer } = useCustomers({ token: accessToken, query: searchTerm })

  const filteredCustomers = useMemo(() => {
    if (statusFilter === 'all') return customers

    return customers.filter((c) => {
      const isBanned = (c as any).isBanned === true
      const isActive = (c as any).isActive === true
      const isInactive = (c as any).isActive === false
      const status = typeof (c as any).status === 'string' ? String((c as any).status).toLowerCase() : ''

      if (statusFilter === 'banned') return isBanned || status === 'banned'
      if (statusFilter === 'active') return (!isBanned && isActive) || status === 'active'
      if (statusFilter === 'inactive') return isInactive || status === 'inactive'
      return true
    })
  }, [customers, statusFilter])

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateUser = async () => {
    if (!createForm.email.trim()) {
      toast.error('Missing required fields', { description: 'Email is required.' })
      return
    }

    if (!createForm.phone.trim()) {
      toast.error('Missing required fields', { description: 'Phone is required for customer invites.' })
      return
    }

    setIsCreating(true)
    try {
      await inviteCustomer({
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        firstName: createForm.firstName.trim() || undefined,
        lastName: createForm.lastName.trim() || undefined,
      })

      toast.success('Invite sent')
      setIsCreateOpen(false)
      setCreateForm({ email: '', firstName: '', lastName: '', phone: '' })
      refresh()
    } catch (error: any) {
      toast.error('Invite failed', { description: error?.message || 'Please try again.' })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AdminLayout
      title="Customers"
      description="View customer lifetime value, contact info, and purchase history."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-md w-full">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} disabled={!isAuthenticated}>
            New customer
          </Button>
        </div>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {error ? error : 'No customers found.'}
                  </TableCell>
                </TableRow>
              )}

              {filteredCustomers.map((u) => {
                const displayName = getCustomerDisplayName(u)
                return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{u.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{u.email || '—'}</TableCell>
                  <TableCell>{u.phone || '—'}</TableCell>
                  <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setLocation(`/axis/customers/${u.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
              <DialogDescription>Send an invite so the customer can set their password.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Required. Used for identity + contact on the invite.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? 'Sending…' : 'Send invite'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
