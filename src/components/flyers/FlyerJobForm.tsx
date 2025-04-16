
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { FlyerSize, PaperType } from "@/components/batches/types/FlyerTypes";

export const FlyerJobForm = () => {
  const navigate = useNavigate();
  const { createJob } = useFlyerJobs();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    job_number: "",
    size: "A4" as FlyerSize,
    paper_weight: "115gsm",
    paper_type: "Matt" as PaperType,
    quantity: 0,
    due_date: new Date(),
    pdf_url: "https://example.com/placeholder.pdf", // Placeholder for now
    file_name: "sample-file.pdf"
  });

  const paperWeightOptions = ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm"];
  const sizeOptions: FlyerSize[] = ["A5", "A4", "DL", "A3"];
  const paperTypeOptions: PaperType[] = ["Matt", "Gloss"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.job_number || formData.quantity <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createJob({
        ...formData,
        due_date: formData.due_date.toISOString(),
      });
      toast.success("Flyer job created successfully");
      navigate("/batches/flyers/jobs");
    } catch (error) {
      console.error("Error creating flyer job:", error);
      toast.error("Failed to create flyer job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "quantity" ? parseInt(value, 10) || 0 : value
    }));
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          className="mr-4"
          onClick={() => navigate("/batches/flyers/jobs")}
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Jobs
        </Button>
        <h2 className="text-xl font-semibold">Create New Flyer Job</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Job Name*</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="job_number">Job Number*</Label>
            <Input
              id="job_number"
              name="job_number"
              value={formData.job_number}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="size">Size*</Label>
            <Select
              value={formData.size}
              onValueChange={(value) => setFormData(prev => ({ ...prev, size: value as FlyerSize }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((size) => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="paper_weight">Paper Weight*</Label>
            <Select
              value={formData.paper_weight}
              onValueChange={(value) => setFormData(prev => ({ ...prev, paper_weight: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select weight" />
              </SelectTrigger>
              <SelectContent>
                {paperWeightOptions.map((weight) => (
                  <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="paper_type">Paper Type*</Label>
            <Select
              value={formData.paper_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, paper_type: value as PaperType }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {paperTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity*</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              value={formData.quantity || ""}
              onChange={handleInputChange}
              min="1"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date*</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date || new Date() }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label>File Upload</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
            <p className="text-gray-500">File upload functionality will be implemented separately</p>
            <p className="text-sm text-gray-400 mt-1">Using placeholder file data for now</p>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/batches/flyers/jobs")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Saving...
              </div>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Job
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
