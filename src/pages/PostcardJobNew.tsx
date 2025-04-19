
import { FlyerJobForm } from "@/components/flyers/FlyerJobForm";

const PostcardJobNew = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Postcard Job</h1>
          <p className="text-gray-500 mt-1">Create a new postcard printing job</p>
        </div>
      </div>

      <FlyerJobForm productType="postcard" />
    </div>
  );
};

export default PostcardJobNew;
