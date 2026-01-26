import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentAvatarUploadProps {
  studentId: string;
  studentName: string;
  currentAvatarUrl?: string | null;
  onAvatarChange: (newUrl: string | null) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
};

export function StudentAvatarUpload({
  studentId,
  studentName,
  currentAvatarUrl,
  onAvatarChange,
  size = 'md',
  editable = true,
}: StudentAvatarUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = studentName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image size must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${studentId}-${Date.now()}.${fileExt}`;
      const filePath = `${studentId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('student-avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('student-avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Notify parent component
      onAvatarChange(publicUrl);

      toast({
        title: 'Success',
        description: 'Student photo updated successfully',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    onAvatarChange(null);
    toast({
      title: 'Success',
      description: 'Student photo removed',
    });
  };

  return (
    <div className="relative inline-block">
      <Avatar className={`${sizeClasses[size]} border-2 border-border`}>
        <AvatarImage src={currentAvatarUrl || undefined} alt={studentName} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={`absolute -bottom-1 -right-1 rounded-full ${
              size === 'sm' ? 'w-6 h-6' : size === 'md' ? 'w-7 h-7' : 'w-8 h-8'
            } shadow-md`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className={`${iconSizes[size]} animate-spin`} />
            ) : (
              <Camera className={iconSizes[size]} />
            )}
          </Button>

          {currentAvatarUrl && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className={`absolute -top-1 -right-1 rounded-full ${
                size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-6 h-6' : 'w-7 h-7'
              } shadow-md`}
              onClick={handleRemoveAvatar}
              disabled={isUploading}
            >
              <X className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
