-- Make progress-photos bucket public so photos can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'progress-photos';

-- Add proper RLS policies for progress-photos bucket
CREATE POLICY "Progress photos are viewable by authenticated users" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'progress-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload their own progress photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own progress photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own progress photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);