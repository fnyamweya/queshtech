import { useState, useEffect } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { Toaster } from '@/components/ui/sonner'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { GoogleOAuthCallbackPage } from '@/pages/auth/google-callback'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SearchCommand } from '@/components/layout/search-command'
import { NotificationBanner } from '@/components/layout/notification-banner'
import { InteractiveTopBar } from '@/components/layout/interactive-top-bar'
import { CookieConsent } from '@/components/layout/cookie-consent'
import { ScrollToTop } from '@/components/layout/scroll-to-top'
import { MiniCart } from '@/components/commerce/mini-cart'
import { HomePage } from '@/pages/home'
import { CategoryPage } from '@/pages/category'
import { ProductDetailPage } from '@/pages/product-detail'
import { SearchPage } from '@/pages/search'
import { CartPage } from '@/pages/cart'
import { CheckoutPage } from '@/pages/checkout'
import { ProfilePage } from '@/pages/profile'
import { TrackOrderPage } from '@/pages/track-order'
import { LoginPage } from '@/pages/login'
import { SignupPage } from '@/pages/signup'
import { ForgotPasswordPage } from '@/pages/forgot-password'
import { PasswordSetPage } from '@/pages/password-set'
import { InvitePage } from '@/pages/invite'
import { AdminLoginPage } from '@/pages/admin/login'
import { AdminPasswordSetPage } from '@/pages/admin/password-set'
import { AdminDashboardPage } from '@/pages/admin/dashboard'
import { AdminProductsPage } from '@/pages/admin/products'
import { AdminProductAddPage } from '@/pages/admin/product-add'
import { AdminProductEditPage } from '@/pages/admin/product-edit'
import { AdminProductViewPage } from '@/pages/admin/product-view'
import { AdminOrdersPage } from '@/pages/admin/orders'
import { AdminCustomersPage } from '@/pages/admin/customers'
import { AdminAnalyticsPage } from '@/pages/admin/analytics'
import { AdminCategoriesPage } from '@/pages/admin/categories'
import { AdminTaxonomiesPage } from '@/pages/admin/taxonomies'
import { AdminBrandsPage } from '@/pages/admin/brands'
import { AdminCollectionsPage } from '@/pages/admin/collections'
import { AdminSettingsPage } from '@/pages/admin/settings'
import { AdminSettingsLocationsPage } from '@/pages/admin/settings-locations'
import { AdminSettingsCurrenciesPage } from '@/pages/admin/settings-currencies'
import { AdminSettingsMpesaPage } from '@/pages/admin/settings-mpesa'
import { AdminSettingsRolesPage } from '@/pages/admin/settings-roles'
import { AdminSettingsWhatsappPage } from '@/pages/admin/settings-whatsapp'
import { AdminSettingsWhatsappTemplatesPage } from '@/pages/admin/settings-whatsapp-templates'
import { AdminSettingsSmsPage } from '@/pages/admin/settings-sms'
import { AdminSettingsR2Page } from '@/pages/admin/settings-s3'
import { AdminSettingsOAuthPage } from '@/pages/admin/settings-oauth'
import { AdminSettingsAlgoliaPage } from '@/pages/admin/settings-algolia'
import { AdminChannelsPage } from '@/pages/admin/channels'
import { AdminTasksPage } from '@/pages/admin/tasks'
import { AdminChatPage } from '@/pages/admin/chat'
import { AdminOrderDetailPage } from '@/pages/admin/order-detail.tsx'
import { AdminCustomerDetailPage } from '@/pages/admin/customer-detail.tsx'
import { AdminCategoryAddPage } from '@/pages/admin/category-add'
import { AdminCategoryEditPage } from '@/pages/admin/category-edit'
import { AdminCategoryViewPage } from '@/pages/admin/category-view'
import { AdminShippingPage } from '@/pages/admin/shipping'
import { AdminShippingZonePage } from '@/pages/admin/shipping-zone'
import { AdminGoogleAuthCallbackPage } from '@/pages/admin/auth-google-callback'
import { AdminPriceListsPage } from '@/pages/admin/pricing/price-lists'
import { AdminVariantPricesPage } from '@/pages/admin/pricing/variant-prices'
import { AdminPromotionsPage } from '@/pages/admin/promotions'
import { useCart } from '@/hooks/use-cart'
import { toast } from 'sonner'
import { AuthProvider } from '@/hooks/use-auth'
import { AdminAuthProvider } from '@/hooks/use-admin-auth'

function App() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart, applyPromoCode, itemCount } = useCart()
  const [location] = useLocation()

  const isAdminRoute = location.startsWith('/axis')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location])

  const handleCheckoutComplete = () => {
    clearCart()
    toast.success('Order placed successfully!', {
      description: 'Thank you for your purchase. You will receive a confirmation email shortly.',
    })
  }

  return (
    <AdminAuthProvider>
      {isAdminRoute ? (
        <>
          <Switch>
            <Route path="/axis/login">
              <AdminLoginPage />
            </Route>
            <Route path="/axis/oauth/google/callback">
              <AdminGoogleAuthCallbackPage />
            </Route>
            <Route path="/axis/password-set/:token?">
              <AdminPasswordSetPage />
            </Route>
            <Route path="/axis/auth/password-set/:token?">
              <AdminPasswordSetPage />
            </Route>
            <Route path="/axis/dashboard">
              <AdminDashboardPage />
            </Route>
            <Route path="/axis/products">
              <AdminProductsPage />
            </Route>
            <Route path="/axis/products/add">
              <AdminProductAddPage />
            </Route>
            <Route path="/axis/products/:id/edit">
              <AdminProductEditPage />
            </Route>
            <Route path="/axis/products/:id">
              <AdminProductViewPage />
            </Route>
            <Route path="/axis/orders">
              <AdminOrdersPage />
            </Route>
            <Route path="/axis/orders/:id">
              <AdminOrderDetailPage />
            </Route>
            <Route path="/axis/customers/:id">
              <AdminCustomerDetailPage />
            </Route>
            <Route path="/axis/customers">
              <AdminCustomersPage />
            </Route>
            <Route path="/axis/analytics">
              <AdminAnalyticsPage />
            </Route>
            <Route path="/axis/categories">
              <AdminCategoriesPage />
            </Route>
            <Route path="/axis/collections">
              <AdminCollectionsPage />
            </Route>
            <Route path="/axis/taxonomies">
              <AdminTaxonomiesPage />
            </Route>
            <Route path="/axis/brands">
              <AdminBrandsPage />
            </Route>
            <Route path="/axis/categories/add">
              <AdminCategoryAddPage />
            </Route>
            <Route path="/axis/categories/:id/edit">
              <AdminCategoryEditPage />
            </Route>
            <Route path="/axis/categories/:id">
              <AdminCategoryViewPage />
            </Route>
            <Route path="/axis/settings">
              <AdminSettingsPage />
            </Route>
            <Route path="/axis/settings/r2">
              <AdminSettingsR2Page />
            </Route>
            <Route path="/axis/settings/currencies">
              <AdminSettingsCurrenciesPage />
            </Route>
            <Route path="/axis/settings/locations">
              <AdminSettingsLocationsPage />
            </Route>
            <Route path="/axis/settings/mpesa">
              <AdminSettingsMpesaPage />
            </Route>
            <Route path="/axis/settings/roles">
              <AdminSettingsRolesPage />
            </Route>
            <Route path="/axis/settings/whatsapp">
              <AdminSettingsWhatsappPage />
            </Route>
            <Route path="/axis/settings/whatsapp/templates">
              <AdminSettingsWhatsappTemplatesPage />
            </Route>
            <Route path="/axis/settings/sms">
              <AdminSettingsSmsPage />
            </Route>
            <Route path="/axis/settings/oauth">
              <AdminSettingsOAuthPage />
            </Route>
            <Route path="/axis/settings/algolia">
              <AdminSettingsAlgoliaPage />
            </Route>
            <Route path="/axis/settings/landing">
              <AdminCollectionsPage />
            </Route>
            <Route path="/axis/channels">
              <AdminChannelsPage />
            </Route>
            <Route path="/axis/shipping">
              <AdminShippingPage />
            </Route>
            <Route path="/axis/shipping/:zoneId/:tab?">
              <AdminShippingZonePage />
            </Route>
            <Route path="/axis/pricing/price-lists">
              <AdminPriceListsPage />
            </Route>
            <Route path="/axis/pricing/variant-prices">
              <AdminVariantPricesPage />
            </Route>
            <Route path="/axis/promotions">
              <AdminPromotionsPage />
            </Route>
            <Route path="/axis/tasks">
              <AdminTasksPage />
            </Route>
            <Route path="/axis/chat">
              <AdminChatPage />
            </Route>
            <Route path="/axis">
              <AdminDashboardPage />
            </Route>
          </Switch>
          <Toaster />
        </>
      ) : (
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <InteractiveTopBar />

            <NotificationBanner
              id="free-shipping-2024"
              message="Free shipping on orders over KES 10,000 • Use code: FREESHIP"
              type="promo"
              action={{ label: 'Shop Now', href: '/' }}
            />

            <Header
              cartItemCount={itemCount}
              onCartClick={() => setIsCartOpen(true)}
              onSearchOpen={() => setIsSearchOpen(true)}
              onMobileMenuOpen={() => setIsMobileNavOpen(true)}
            />

            <main className="flex-1 bg-background">
              <Switch>
                <Route path="/">
                  <HomePage onAddToCart={addToCart} />
                </Route>
                <Route path="/search">
                  <SearchPage onAddToCart={addToCart} />
                </Route>
                <Route path="/category/:slug">
                  <CategoryPage onAddToCart={addToCart} />
                </Route>
                <Route path="/product/:slug">
                  <ProductDetailPage onAddToCart={addToCart} />
                </Route>
                <Route path="/cart">
                  <CartPage
                    cart={cart}
                    onQuantityChange={updateQuantity}
                    onRemove={removeFromCart}
                    onApplyPromo={applyPromoCode}
                  />
                </Route>
                <Route path="/checkout">
                  <CheckoutPage cart={cart} onComplete={handleCheckoutComplete} />
                </Route>
                <Route path="/profile/:tab?">
                  <ProfilePage />
                </Route>
                <Route path="/track-order">
                  <TrackOrderPage />
                </Route>
                <Route path="/login">
                  <LoginPage />
                </Route>
                <Route path="/signup">
                  <SignupPage />
                </Route>
                <Route path="/oauth/google/callback">
                  <GoogleOAuthCallbackPage />
                </Route>
                <Route path="/forgot-password/:step?">
                  <ForgotPasswordPage />
                </Route>
                <Route path="/password-set/:token?">
                  <PasswordSetPage />
                </Route>
                <Route path="/auth/password-set/:token?">
                  <PasswordSetPage />
                </Route>
                <Route path="/invite/:token?">
                  <InvitePage />
                </Route>
                <Route path="/auth/invite/:token?">
                  <InvitePage />
                </Route>
                <Route>
                  <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-12 text-center">
                    <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
                    <p className="text-muted-foreground mb-8">
                      The page you're looking for doesn't exist or has been moved.
                    </p>
                    <a href="/" className="text-primary hover:underline font-medium">
                      Return to Home
                    </a>
                  </div>
                </Route>
              </Switch>
            </main>

            <Footer />

            <MobileNav open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen} />

            <SearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />

            <MiniCart
              isOpen={isCartOpen}
              onClose={() => setIsCartOpen(false)}
              cart={cart}
              onQuantityChange={updateQuantity}
              onRemove={removeFromCart}
              onAddToCart={addToCart}
            />

            <ScrollToTop />
            <CookieConsent />
            <Toaster />
          </div>
        </AuthProvider>
      )}
    </AdminAuthProvider>
  )
}

export default App
