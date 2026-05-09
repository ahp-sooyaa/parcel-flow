import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  return (
    <Card className="w-full max-w-md border-[#3f3a52] bg-white text-foreground shadow-2xl">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the phone number and password provided by your admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone number</Label>
            <Input id="phoneNumber" name="phoneNumber" placeholder="09..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" />
          </div>
          <Button className="w-full" type="submit">
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
