
import { supabase } from "@/integrations/supabase/client";

export const buildJobQuery = async (productType: string, batchId: string) => {
  // Core columns that exist in all job tables after the migration
  const coreColumns = "id, name, quantity, status, pdf_url, file_name, job_number, created_at, updated_at, due_date, user_id, batch_id, batch_ready, batch_allocated_at, batch_allocated_by";

  switch (productType) {
    case "Business Cards":
      const { data: businessCardJobs, error: bcError } = await supabase
        .from("business_card_jobs")
        .select(`${coreColumns}, double_sided`)
        .eq("batch_id", batchId)
        .order("name");
      
      if (bcError) throw bcError;
      return businessCardJobs || [];
      
    case "Flyers":
      const { data: flyerJobs, error: flyerError } = await supabase
        .from("flyer_jobs")
        .select(coreColumns)
        .eq("batch_id", batchId)
        .order("name");
      
      if (flyerError) throw flyerError;
      return flyerJobs || [];
      
    case "Postcards":
      const { data: postcardJobs, error: postcardError } = await supabase
        .from("postcard_jobs")
        .select(coreColumns)
        .eq("batch_id", batchId)
        .order("name");
      
      if (postcardError) throw postcardError;
      return postcardJobs || [];
      
    case "Boxes":
      const { data: boxJobs, error: boxError } = await supabase
        .from("box_jobs")
        .select(coreColumns)
        .eq("batch_id", batchId)
        .order("name");
      
      if (boxError) throw boxError;
      return boxJobs || [];
      
    case "Covers":
      const { data: coverJobs, error: coverError } = await supabase
        .from("cover_jobs")
        .select(coreColumns)
        .eq("batch_id", batchId)
        .order("name");
      
      if (coverError) throw coverError;
      return coverJobs || [];
      
    case "Sleeves":
      const { data: sleeveJobs, error: sleeveError } = await supabase
        .from("sleeve_jobs")
        .select(`${coreColumns}, single_sided`)
        .eq("batch_id", batchId)
        .order("name");
      
      if (sleeveError) throw sleeveError;
      return sleeveJobs || [];
      
    case "Stickers":
      const { data: stickerJobs, error: stickerError } = await supabase
        .from("sticker_jobs")
        .select(coreColumns)
        .eq("batch_id", batchId)
        .order("name");
      
      if (stickerError) throw stickerError;
      return stickerJobs || [];
      
    case "Posters":
      const { data: posterJobs, error: posterError } = await supabase
        .from("poster_jobs")
        .select(coreColumns)
        .eq("batch_id", batchId)
        .order("name");
      
      if (posterError) throw posterError;
      return posterJobs || [];
      
    default:
      return [];
  }
};
