import React, { useEffect } from 'react';
import { ShoppingCart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '../store/useCartStore';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Cart from './Cart';
import AuthModal from './AuthModal';
import { useToast } from '@/components/ui/use-toast';
import { signIn, signOut } from "@/services/authService";
import { UserRegistration } from '@/data/userRegistration';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onCheckout: () => void;
  onUserInfo?: (user: UserRegistration | null) => void;
  onLogout: () => void;
}

const TEST_AUTH_MODE = import.meta.env.VITE_ENABLE_TEST_AUTH_MODE === 'true';

const TEST_USER: UserRegistration = {
  id: 'test-client-user',
  first_name: 'Test Client',
  email: 'test-client@local.dev',
  password: '',
  contact_number: '0712345678',
  business_type: 'tavern',
  address: {
    street: '10 Voortrekker Street',
    city: 'Vereeniging',
    postal_code: '1930',
  },
};

const Header: React.FC<HeaderProps> = ({ onCheckout, onUserInfo, onLogout }) => {
  const { toast } = useToast();
  const { items, clearCart } = useCartStore();
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const [open, setOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(TEST_AUTH_MODE);
  const [user, setUser] = React.useState<UserRegistration | null>(TEST_AUTH_MODE ? TEST_USER : null);
  const [showAuth, setShowAuth] = React.useState(false);

  useEffect(() => {
    if (TEST_AUTH_MODE) {
      setIsLoggedIn(true);
      setUser(TEST_USER);
      setShowAuth(false);
    }
  }, []);

  useEffect(() => {
    onUserInfo?.(user);
  }, [user, onUserInfo]);

  const handleLogin = async (username: string, password: string) => {
    if (TEST_AUTH_MODE) {
      setIsLoggedIn(true);
      setUser(TEST_USER);
      setShowAuth(false);
      return;
    }

    await signIn(username, password)
      .then((response) => {
        setUser({
          id: response?.user?.id || '',
          first_name: response?.user?.user_metadata?.first_name || 'User',
          email: response?.user?.email || '',
          password: '',
          contact_number: response?.user?.user_metadata?.contact_number || '',
          business_type: response?.user?.user_metadata?.business_type || 'tavern',
          address: {
            street: response?.user?.user_metadata?.street || '',
            city: response?.user?.user_metadata?.city || '',
            postal_code: response?.user?.user_metadata?.postal_code || '',
          },
        });

        setIsLoggedIn(true);
        setShowAuth(false);
        handleToastMessage('success', 'Login Successful', 'Welcome back!');
      })
      .catch((error) => {
        console.error('Sign-in error:', error);
        handleToastMessage('error', 'Login Failed', `${error.message}`);
        setIsLoggedIn(false);
        setUser(null);
      });
  };

  const handleLogout = () => {
    clearCart();

    if (TEST_AUTH_MODE) {
      onLogout();
      setOpen(false);
      return;
    }

    signOut();
    setIsLoggedIn(false);
    setUser(null);
    onLogout();
  };

  const handleCartLogin = () => {
    if (TEST_AUTH_MODE) {
      setOpen(false);
      return;
    }

    setOpen(false);
    setShowAuth(true);
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    handleLogin(email, password);
  };

  const handleCheckout = () => {
    onCheckout();
    setOpen(false);
  };

  const handleToastMessage = (type: 'success' | 'error', title: string, description: string) => {
    toast({
      title,
      description,
      variant: type === 'error' ? 'destructive' : 'default',
    });
  };

  return (
    <header className="bg-white py-4 px-4 shadow-md sticky top-0 z-10">
      <div className="container mx-auto flex justify-between items-center gap-2">
        <div className="flex items-center shrink-0">
          <img src="/logo.png" alt="Thenga Logo" className="h-10" />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          {isLoggedIn ? (
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
                <Link to="/my-orders" state={{ user }}>
                  My Orders
                </Link>
              </Button>
              <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-24">{user?.first_name}</span>
              {!TEST_AUTH_MODE ? (
                <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={handleLogout}>
                  Logout
                </Button>
              ) : (
                <span className="hidden sm:inline text-xs text-amber-600">Test Auth Mode</span>
              )}
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={() => setShowAuth(true)}>
              <User className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative h-11 w-11 bg-white text-thenga-blue border-thenga-lightgray hover:bg-thenga-lightgray"
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-thenga-yellow text-thenga-blue rounded-full w-5 h-5 flex items-center justify-center text-xs">
                    {itemCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[350px] flex flex-col h-full">
              <Cart onCheckout={handleCheckout} isLoggedIn={isLoggedIn} onLogin={() => handleCartLogin()} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {!TEST_AUTH_MODE && (
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onToastMessage={handleToastMessage}
        />
      )}
    </header>
  );
};

export default Header;
