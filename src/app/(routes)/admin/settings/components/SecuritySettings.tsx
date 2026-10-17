'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield } from 'lucide-react';

interface SecuritySettingsProps {
  settings: any;
  onUpdate: (data: any) => void;
  isLoading?: boolean;
}

export default function SecuritySettings({ settings, onUpdate, isLoading }: SecuritySettingsProps) {
  const [formData, setFormData] = useState({
    twoFactorAuth: settings?.twoFactorAuth ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
  };

  const handleToggle = (field: string, value: boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 sm:gap-2">
          <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
          Security Settings
        </CardTitle>
        <CardDescription>
          Manage your account security and authentication preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  Two-Factor Authentication
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account with 2FA
                </p>
              </div>
              <Switch
                checked={formData.twoFactorAuth}
                onCheckedChange={(checked) => handleToggle('twoFactorAuth', checked)}
              />
            </div>

            {formData.twoFactorAuth && (
              <div className="bg-blue-50 border border-blue-200 rounded-md sm:rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-1.5 sm:gap-2">
                  <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Two-Factor Authentication Enabled</p>
                    <p className="mt-1">
                      Your account is now protected with 2FA. You'll need to enter a verification code
                      from your authenticator app when signing in.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}