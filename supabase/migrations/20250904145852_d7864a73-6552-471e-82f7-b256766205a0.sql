-- Make progress-photos bucket public so photos can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'progress-photos';