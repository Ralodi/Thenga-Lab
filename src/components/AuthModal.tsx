import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { signUp } from "@/services/authService";
import { UserRegistration } from "@/data/userRegistration";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (email: string, password: string) => void;
    onRegister: (name: string, email: string, password: string) => void;
    onToastMessage: (type: "success" | "error", title: string, description: string) => void;
}

const userRegistration: UserRegistration = {
    email: "",
    password: "",
    first_name: "",
    contact_number: "",
    address: {
        city: "",
        street: "",
        postal_code: ""
    }
};

const AuthModal = ({ isOpen, onClose, onLogin, onRegister, onToastMessage }: AuthModalProps) => {
    const [loginEmail, setLoginEmail] = useState("");
    const [loginUsername, setLoginUsername] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [registerName, setRegisterName] = useState("");
    const [registerEmail, setRegisterEmail] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [registerUsername, setRegisterUsername] = useState("");
    const [registerPassword, setRegisterPassword] = useState("");
    const [useUsername, setUseUsername] = useState(false);
    const [registerAddress, setRegisterAddress] = useState({
        street: "",
        city: "",
        postalCode: ""
    });
    if (!isOpen) return null;

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const userNameValue = useUsername ? `${loginUsername}@thenga-user.com` : loginEmail;        
        onLogin(userNameValue, loginPassword);
        setLoginEmail("");
        setLoginUsername("");
        setLoginPassword("");
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        const emailValue = useUsername ? `${registerUsername}@thenga-user.com` : registerEmail;
        // Prepare the userRegistration object
        userRegistration.email = emailValue;
        userRegistration.password = registerPassword;
        userRegistration.first_name = registerName;
        userRegistration.contact_number = contactNumber;
        userRegistration.address = {
            city: registerAddress.city,
            street: registerAddress.street,
            postal_code: registerAddress.postalCode
        };

        // Call the signUp function with the userRegistration object 
        await signUp(userRegistration).then(response => {
            console.log("User registered successfully:", response);
            // Reset the form fields
            setUseUsername(false);
            setRegisterName("");
            setRegisterEmail("");
            setRegisterUsername("");
            setRegisterPassword("");
            setRegisterAddress({
                street: "",
                city: "",
                postalCode: ""
            });

            onToastMessage("success", "Registration Successful", "You have successfully registered. Please log in to continue.");
            onRegister(registerName, emailValue, registerPassword);
            onClose();
        }
        ).catch(error => {
            console.error("Error registering user:", error);
            onToastMessage("error", "Registration Failed", `There was an error registering your account. ${error.message}`);
        }
        );
    };

    const handleAddressChange = (field: string, value: string) => {
        setRegisterAddress(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Welcome to Thenga</CardTitle>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            ×
                        </Button>
                    </div>
                    <CardDescription>
                        Sign in to your account or create a new one
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="login">Login</TabsTrigger>
                            <TabsTrigger value="register">Register</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login" className="space-y-4">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="use-username"
                                        checked={useUsername}
                                        onCheckedChange={setUseUsername}
                                    />
                                    <Label htmlFor="use-username" className="text-sm">
                                        Use username instead of email
                                    </Label>
                                </div>
                                <div className="space-y-2">
                                    {useUsername ? (
                                        <div className="space-y-2">
                                            <Label htmlFor="login-username">Username</Label>
                                            <Input
                                                id="login-username"
                                                type="text"
                                                placeholder="Enter your username"
                                                value={loginUsername}
                                                onChange={(e) => setLoginUsername(e.target.value)}
                                                required
                                            />
                                        </div>
                                    ) : (
                                        <><Label htmlFor="login-email">Email</Label><Input
                                            id="login-email"
                                            type="email"
                                            placeholder="Enter your email"
                                            value={loginEmail}
                                            onChange={(e) => setLoginEmail(e.target.value)}
                                            required /></>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="login-password">Password</Label>
                                    <Input
                                        id="login-password"
                                        type="password"
                                        placeholder="Enter your password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full">
                                    Sign In
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register" className="space-y-4">
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="register-name">Full Name</Label>
                                    <Input
                                        id="register-name"
                                        type="text"
                                        placeholder="Enter your full name"
                                        value={registerName}
                                        onChange={(e) => setRegisterName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="register-name">Contact Number</Label>
                                    <Input
                                        id="contact-number"
                                        type="tel"
                                        placeholder="Enter your contact number"
                                        value={contactNumber}
                                        onChange={(e) => setContactNumber(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="use-username"
                                        checked={useUsername}
                                        onCheckedChange={setUseUsername}
                                    />
                                    <Label htmlFor="use-username" className="text-sm">
                                        Use username instead of email
                                    </Label>
                                </div>

                                {useUsername ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="register-username">Username</Label>
                                        <Input
                                            id="register-username"
                                            type="text"
                                            placeholder="Enter your username"
                                            value={registerUsername}
                                            onChange={(e) => setRegisterUsername(e.target.value)}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor="register-email">Email</Label>
                                        <Input
                                            id="register-email"
                                            type="email"
                                            placeholder="Enter your email"
                                            value={registerEmail}
                                            onChange={(e) => setRegisterEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="register-password">Password</Label>
                                    <Input
                                        id="register-password"
                                        type="password"
                                        placeholder="Create a password"
                                        value={registerPassword}
                                        onChange={(e) => setRegisterPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-4 pt-2 border-t">
                                    <h4 className="text-sm font-medium text-gray-700">Address Information</h4>

                                    <div className="space-y-2">
                                        <Label htmlFor="register-street">Street Address</Label>
                                        <Input
                                            id="register-street"
                                            type="text"
                                            placeholder="Enter your street address"
                                            value={registerAddress.street}
                                            onChange={(e) => handleAddressChange('street', e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="register-city">City</Label>
                                            <Input
                                                id="register-city"
                                                type="text"
                                                placeholder="City"
                                                value={registerAddress.city}
                                                onChange={(e) => handleAddressChange('city', e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="register-postalCode">ZIP Code</Label>
                                            <Input
                                                id="register-postalCode"
                                                type="text"
                                                placeholder="Postal Code"
                                                value={registerAddress.postalCode}
                                                onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full">
                                    Create Account
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};

export default AuthModal;