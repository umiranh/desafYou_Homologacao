-- Create RLS policies for progress-photos storage bucket
-- Allow users to upload their own progress photos
CREATE POLICY "Users can upload their own progress photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'progress-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own progress photos
CREATE POLICY "Users can view their own progress photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'progress-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own progress photos
CREATE POLICY "Users can delete their own progress photos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'progress-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);