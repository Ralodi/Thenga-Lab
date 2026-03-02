
import React, { useEffect } from 'react';
import { ShoppingCart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '../store/useCartStore';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Cart from './Cart';
import AuthModal from './AuthModal';
import { useToast } from '@/components/ui/use-toast';
import { signIn, signOut, getUser } from "@/services/authService";
import { UserRegistration } from '@/data/userRegistration';

interface HeaderProps {
  onCheckout: () => void;
  onUserInfo?: (user: UserRegistration | null) => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onCheckout, onUserInfo, onLogout }) => {
  const { toast } = useToast();
  const { items, clearCart } = useCartStore();
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const [open, setOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [user, setUser] = React.useState<UserRegistration | null>(null);
  const [showAuth, setShowAuth] = React.useState(false);

  useEffect(() => {
    onUserInfo(user);
  }, [user]);

  const handleLogin = async (username: string, password: string) => {
    await signIn(username, password).then((response) => {

      setUser({
        id: response?.user?.id || '',
        first_name: response?.user?.user_metadata?.first_name || 'User',
        email: response?.user?.email || '',
        password: '',
        contact_number: response?.user?.user_metadata?.contact_number || '',
        address: {
          street: response?.user?.user_metadata?.street || '',
          city: response?.user?.user_metadata?.city || '',
          postal_code: response?.user?.user_metadata?.postal_code || ''
        }
      });

      setIsLoggedIn(true);
      setShowAuth(false);
      handleToastMessage("success", "Login Successful", "Welcome back!");
    }
    ).catch((error) => {
      console.error('Sign-in error:', error);
      handleToastMessage("error", "Login Failed", `${error.message}`);
      setIsLoggedIn(false);
      setUser(null);
    }
    );
  };

  const handleLogout = () => {
    clearCart();    
    signOut();
    setIsLoggedIn(false);
    setUser(null);
    onLogout();
  };

  const handleCartLogin = () => {
    setOpen(false);
    setShowAuth(true);    
  }

  const handleRegister = async (name: string, email: string, password: string) => {
    handleLogin(email, password);
  };

  const handleCheckout = () => {
    onCheckout();
    setOpen(false);
  }

  const handleToastMessage = (type, title, description) => {
    toast({
      title,
      description,
      variant: type === "error" ? "destructive" : "default"
    });
  }


  return (
    <header className="bg-white py-4 px-4 shadow-md sticky top-0 z-10">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <img
            src="/logo.png"
            alt="Thenga Logo"
            className="h-10"
          />
        </div>

        <div className="flex items-center">
          {isLoggedIn ? (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{user?.first_name}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setShowAuth(true)}>
              <User className="h-4 w-4 mr-2" />
              Login
            </Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative mr-2 bg-white text-thenga-blue border-thenga-lightgray hover:bg-thenga-lightgray"
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
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onToastMessage={handleToastMessage}
      />
    </header>
  );
};

export default Header;
