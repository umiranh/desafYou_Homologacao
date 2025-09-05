import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2 } from 'lucide-react';
import { validateFileUpload } from '@/utils/inputSanitizer';

interface PhotoUploadProps {
  onPhotoUploaded: (url: string) => void;
  bucketName: 'progress-photos' | 'post-images';
  currentPhotoUrl?: string;
  className?: string;
  label?: string;
}

export function PhotoUpload({ 
  onPhotoUploaded, 
  bucketName, 
  currentPhotoUrl, 
  className = '',
  label = 'Adicionar Foto'
}: PhotoUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(currentPhotoUrl || '');
  const [isUploading, setIsUploading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Security validation: File size limit (5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

      // Security validation: File type validation
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Apenas imagens (JPEG, PNG, GIF, WebP) são permitidas",
          variant: "destructive",
        });
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${user.id}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: false });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleUpload = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadImage(selectedImage);
      onPhotoUploaded(imageUrl);
      
      toast({
        title: "Foto enviada!",
        description: "Sua foto foi salva com sucesso",
      });
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Erro ao enviar foto",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      
      {imagePreview && (
        <div className="relative w-full h-32 rounded-lg overflow-hidden">
          <img 
            src={imagePreview} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <input
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleImageSelect}
        className="hidden"
        id={`photo-upload-${bucketName}`}
        max="1"
      />
      
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById(`photo-upload-${bucketName}`)?.click()}
          className="flex-1"
        >
          <Camera className="h-4 w-4 mr-2" />
          {imagePreview ? 'Trocar Foto' : 'Escolher Foto'}
        </Button>
        
        {selectedImage && (
          <Button
            type="button"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Enviar
          </Button>
        )}
      </div>
    </div>
  );
}