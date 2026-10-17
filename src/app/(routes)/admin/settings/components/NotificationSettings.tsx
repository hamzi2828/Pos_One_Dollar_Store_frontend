'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface NotificationSettingsProps {
  settings: any;
  onUpdate: (data: any) => void;
  isLoading?: boolean;
}

export default function NotificationSettings({ settings, onUpdate, isLoading }: NotificationSettingsProps) {
  const [formData, setFormData] = useState({
    emailNotifications: settings?.emailNotifications ?? true,
    marketingEmails: settings?.marketingEmails ?? false,
    securityAlerts: settings?.securityAlerts ?? true,
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
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Manage your notification preferences and alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive general notifications via email
                </p>
              </div>
              <Switch
                checked={formData.emailNotifications}
                onCheckedChange={(checked) => handleToggle('emailNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Receive promotional and marketing emails
                </p>
              </div>
              <Switch
                checked={formData.marketingEmails}
                onCheckedChange={(checked) => handleToggle('marketingEmails', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Security Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive important security notifications
                </p>
              </div>
              <Switch
                checked={formData.securityAlerts}
                onCheckedChange={(checked) => handleToggle('securityAlerts', checked)}
              />
            </div>
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