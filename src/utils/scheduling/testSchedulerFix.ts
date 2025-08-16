/**
 * SCHEDULER FIX VERIFICATION SCRIPT
 * Tests the new UTC-first timezone handling to ensure jobs are scheduled correctly
 */

import { supabase } from "@/integrations/supabase/client";
import { findNextAvailableSlot, sastDateToDbUtcIso } from "./findNextAvailableSlot";
import { BusinessLogicEngine } from "./businessLogicEngine";
import { formatSAST, toSAST, fromSAST } from "../timezone";

interface TestResult {
  passed: number;
  failed: number;
  errors: string[];
}

/**
 * Test scheduler with HP 12000 jobs to verify they pack into Monday 8 AM
 */
export async function testSchedulerFix(): Promise<TestResult> {
  const result: TestResult = { passed: 0, failed: 0, errors: [] };
  
  function test(name: string, testFn: () => void | Promise<void>) {
    return Promise.resolve().then(async () => {
      try {
        await testFn();
        console.log(`✅ ${name}`);
        result.passed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${name}: ${message}`);
        result.errors.push(`${name}: ${message}`);
        result.failed++;
      }
    });
  }

  console.log('🧪 **SCHEDULER FIX VERIFICATION TESTS**');

  // Test 1: Verify 8:00 AM SAST converts to 6:00 AM UTC
  await test('8:00 AM SAST → 6:00 AM UTC conversion', () => {
    const sastTime = new Date('2025-08-18T08:00:00'); // 8 AM local
    const utcTime = fromSAST(sastTime);
    
    if (utcTime.getUTCHours() !== 6) {
      throw new Error(`Expected 6:00 AM UTC, got ${utcTime.getUTCHours()}:${utcTime.getUTCMinutes()}`);
    }
  });

  // Test 2: Verify business hours calculation
  await test('Business hours calculation is correct', () => {
    const testTime = new Date('2025-08-18T10:00:00+02:00'); // 10 AM SAST
    const sassTime = toSAST(testTime);
    
    if (sassTime.getHours() !== 10) {
      throw new Error(`Expected 10 AM SAST, got ${sassTime.getHours()}`);
    }
  });

  // Test 3: Find next available slot returns 8:00 AM start time
  await test('findNextAvailableSlot starts at 8:00 AM SAST', async () => {
    // Get HP 12000 stage ID
    const { data: stageData } = await supabase
      .from('production_stages')
      .select('id')
      .eq('name', 'HP 12000')
      .limit(1)
      .maybeSingle();

    if (!stageData) {
      throw new Error('HP 12000 stage not found');
    }

    const slot = await findNextAvailableSlot(
      supabase,
      stageData.id,
      20, // 20 minutes
      {
        workingHours: { startHour: 8, endHour: 17.5 },
        horizonDays: 30
      }
    );

    if (!slot) {
      throw new Error('No slot found');
    }

    const slotHour = slot.getHours();
    if (slotHour !== 8) {
      throw new Error(`Expected slot at 8:00 AM, got ${slotHour}:${slot.getMinutes()}`);
    }
  });

  // Test 4: Multiple short jobs should pack into same day
  await test('Multiple short jobs pack into same day', async () => {
    const { data: stageData } = await supabase
      .from('production_stages')
      .select('id')
      .eq('name', 'HP 12000')
      .limit(1)
      .maybeSingle();

    if (!stageData) {
      throw new Error('HP 12000 stage not found');
    }

    // Simulate in-memory allocations map
    const allocations = new Map();
    
    // Schedule first job
    const slot1 = await findNextAvailableSlot(
      supabase,
      stageData.id,
      20,
      {
        workingHours: { startHour: 8, endHour: 17.5 },
        existingAllocations: allocations
      }
    );

    // Schedule second job
    const slot2 = await findNextAvailableSlot(
      supabase,
      stageData.id,
      20,
      {
        workingHours: { startHour: 8, endHour: 17.5 },
        existingAllocations: allocations
      }
    );

    if (!slot1 || !slot2) {
      throw new Error('Could not find slots');
    }

    // Both should be on the same day
    const day1 = slot1.toDateString();
    const day2 = slot2.toDateString();
    
    if (day1 !== day2) {
      throw new Error(`Jobs scheduled on different days: ${day1} vs ${day2}`);
    }

    // Second job should start after first job ends
    const slot1End = new Date(slot1.getTime() + 20 * 60000);
    if (slot2.getTime() < slot1End.getTime()) {
      throw new Error('Jobs overlap or are not sequential');
    }
  });

  // Test 5: Database storage format verification
  await test('Database storage uses correct UTC format', () => {
    const sastTime = new Date('2025-08-18T08:00:00'); // 8 AM local
    const dbTime = sastDateToDbUtcIso(sastTime);
    
    // Should be stored as 6 AM UTC
    const parsed = new Date(dbTime);
    if (parsed.getUTCHours() !== 6) {
      throw new Error(`Expected 6:00 AM UTC in DB, got ${parsed.getUTCHours()}:${parsed.getUTCMinutes()}`);
    }
  });

  console.log(`\n📊 **SCHEDULER FIX TEST RESULTS:**`);
  console.log(`✅ Passed: ${result.passed}`);
  console.log(`❌ Failed: ${result.failed}`);
  
  if (result.failed > 0) {
    console.log(`\n🚨 **ERRORS:**`);
    result.errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log(`\n🎉 **SCHEDULER FIX VERIFIED: All timezone tests passed!**`);
  }

  return result;
}

/**
 * Debug function to show current scheduling state
 */
export async function debugSchedulingState(): Promise<void> {
  console.log('\n🔍 **SCHEDULING DEBUG STATE**');
  
  try {
    // Get HP 12000 stage
    const { data: stageData } = await supabase
      .from('production_stages')
      .select('*')
      .eq('name', 'HP 12000')
      .limit(1)
      .maybeSingle();

    if (!stageData) {
      console.log('❌ HP 12000 stage not found');
      return;
    }

    console.log(`📋 Stage: ${stageData.name} (${stageData.id})`);

    // Get current scheduled jobs
    const { data: scheduledJobs } = await supabase
      .from('job_stage_instances')
      .select('id, scheduled_start_at, scheduled_end_at, scheduled_minutes')
      .eq('production_stage_id', stageData.id)
      .not('scheduled_start_at', 'is', null)
      .order('scheduled_start_at');

    console.log(`⏰ Currently scheduled jobs: ${scheduledJobs?.length || 0}`);
    
    if (scheduledJobs && scheduledJobs.length > 0) {
      scheduledJobs.forEach((job, i) => {
        const start = new Date(job.scheduled_start_at!);
        const end = new Date(job.scheduled_end_at!);
        const startSAST = toSAST(start);
        const endSAST = toSAST(end);
        
        console.log(`  ${i + 1}. ${formatSAST(startSAST, 'MMM dd HH:mm')} - ${formatSAST(endSAST, 'HH:mm')} (${job.scheduled_minutes}min)`);
      });
    }

    // Find next available slot
    const nextSlot = await findNextAvailableSlot(
      supabase,
      stageData.id,
      20,
      {
        workingHours: { startHour: 8, endHour: 17.5 },
        horizonDays: 7
      }
    );

    if (nextSlot) {
      console.log(`🎯 Next available slot: ${formatSAST(nextSlot, 'MMM dd HH:mm')}`);
    } else {
      console.log('❌ No available slots found in next 7 days');
    }

  } catch (error) {
    console.error('Debug error:', error);
  }
}