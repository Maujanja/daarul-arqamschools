DROP TRIGGER IF EXISTS dormitories_sync_beds ON public.dormitories;
CREATE TRIGGER dormitories_sync_beds AFTER INSERT OR UPDATE OF capacity, room_count, beds_per_room, bed_type, code ON public.dormitories
FOR EACH ROW EXECUTE FUNCTION public.sync_dorm_beds();