
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { proofUrl, customerEmail, jobDetails } = await req.json();

    console.log('📧 Sending proof email to:', customerEmail);

    const emailResponse = await resend.emails.send({
      from: 'proofing@jaimar.dev',
      to: [customerEmail],
      subject: `Proof Ready for Review - ${jobDetails.jobNumber || 'Job'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px;">
            <img src="https://i.imgur.com/YourLogoHere.png" alt="IMPRESS" style="max-width: 200px; margin-bottom: 20px;" />
          </div>
          
          <h1 style="color: #333; text-align: center;">Your Proof is Ready for Review</h1>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">Job Details:</h2>
            <p><strong>Job Number:</strong> ${jobDetails.jobNumber || 'N/A'}</p>
            <p><strong>Customer:</strong> ${jobDetails.customer || 'N/A'}</p>
            <p><strong>Description:</strong> ${jobDetails.description || 'N/A'}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${proofUrl}" 
               style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Review Your Proof
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>Important:</strong> Please review your proof carefully and respond within 7 days. 
              This link will expire after that time.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #666; font-size: 14px; text-align: center;">
            If you have any questions, please contact us directly.<br/>
            This email was sent from an automated system, please do not reply.
          </p>
        </div>
      `,
    });

    console.log('✅ Proof email sent successfully:', (emailResponse as any).id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: (emailResponse as any).id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error sending proof email:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send email' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
