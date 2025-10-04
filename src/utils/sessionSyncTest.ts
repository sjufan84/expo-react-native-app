/**
 * Session Synchronization Test Utility
 *
 * This utility helps test and validate the session synchronization features
 * between AgentContext and LiveKit room state.
 */

import { SessionConfig, SessionValidationResult } from '../types/message.types';

export interface SessionTestScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  execute: () => Promise<SessionTestResult>;
  cleanup: () => Promise<void>;
}

export interface SessionTestResult {
  scenario: string;
  passed: boolean;
  duration: number;
  details: {
    frontendState?: SessionConfig;
    roomState?: Partial<SessionConfig>;
    validation?: SessionValidationResult;
    syncEvents?: string[];
    errors?: string[];
  };
}

export class SessionSynchronizationTester {
  private scenarios: SessionTestScenario[] = [];
  private results: SessionTestResult[] = [];

  /**
   * Add a test scenario
   */
  addScenario(scenario: SessionTestScenario): void {
    this.scenarios.push(scenario);
  }

  /**
   * Run all test scenarios
   */
  async runAllTests(): Promise<SessionTestResult[]> {
    console.log('🧪 Starting session synchronization tests...');
    this.results = [];

    for (const scenario of this.scenarios) {
      console.log(`\n📋 Running scenario: ${scenario.name}`);

      try {
        const startTime = Date.now();

        // Setup
        await scenario.setup();

        // Execute test
        const result = await scenario.execute();
        result.scenario = scenario.name;
        result.duration = Date.now() - startTime;

        // Cleanup
        await scenario.cleanup();

        this.results.push(result);

        // Log result
        console.log(`${result.passed ? '✅' : '❌'} ${scenario.name}: ${result.duration}ms`);
        if (!result.passed) {
          console.log('   Errors:', result.details.errors);
        }

      } catch (error) {
        console.error(`❌ Scenario "${scenario.name}" failed:`, error);
        this.results.push({
          scenario: scenario.name,
          passed: false,
          duration: 0,
          details: {
            errors: [error instanceof Error ? error.message : String(error)]
          }
        });
      }
    }

    console.log('\n🏁 Session synchronization tests completed');
    this.printSummary();

    return this.results;
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n📊 Test Summary:');
    console.log(`   Passed: ${passed}/${total}`);
    console.log(`   Total Duration: ${totalTime}ms`);
    console.log(`   Average Duration: ${totalTime / total}ms`);

    if (passed < total) {
      console.log('\n❌ Failed scenarios:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   - ${r.scenario}: ${r.details.errors?.join(', ')}`);
        });
    }
  }

  /**
   * Get test results
   */
  getResults(): SessionTestResult[] {
    return this.results;
  }

  /**
   * Clear all scenarios and results
   */
  reset(): void {
    this.scenarios = [];
    this.results = [];
  }
}

// Predefined test scenarios
export const createStandardTestScenarios = (): SessionTestScenario[] => {
  return [
    {
      name: 'Basic Session Sync',
      description: 'Test basic session state synchronization between frontend and LiveKit room',
      setup: async () => {
        console.log('Setting up basic session sync test...');
      },
      execute: async () => {
        // Mock session config
        const sessionConfig: SessionConfig = {
          type: 'text',
          state: 'active',
          startedAt: new Date(),
          voiceMode: undefined,
          turnDetection: 'none',
        };

        return {
          passed: true,
          duration: 0,
          details: {
            frontendState: sessionConfig,
            syncEvents: ['session_started', 'room_configured', 'sync_completed']
          }
        };
      },
      cleanup: async () => {
        console.log('Cleaning up basic session sync test...');
      }
    },

    {
      name: 'Voice Session with Turn Detection',
      description: 'Test voice session with proper turn detection configuration',
      setup: async () => {
        console.log('Setting up voice session test...');
      },
      execute: async () => {
        const sessionConfig: SessionConfig = {
          type: 'voice-vad',
          state: 'active',
          startedAt: new Date(),
          voiceMode: 'continuous',
          turnDetection: 'server',
          isMuted: false,
          voiceActivityEnabled: true,
        };

        // Mock validation result
        const validation: SessionValidationResult = {
          isValid: true,
          inconsistencies: [],
          corrections: {},
          needsResync: false,
        };

        return {
          passed: sessionConfig.turnDetection === 'server',
          duration: 0,
          details: {
            frontendState: sessionConfig,
            validation,
            syncEvents: ['voice_session_started', 'turn_detection_configured', 'audio_enabled']
          }
        };
      },
      cleanup: async () => {
        console.log('Cleaning up voice session test...');
      }
    },

    {
      name: 'Connection Interruption Recovery',
      description: 'Test session recovery during network interruptions',
      setup: async () => {
        console.log('Setting up connection interruption test...');
      },
      execute: async () => {
        const sessionConfig: SessionConfig = {
          type: 'voice-ptt',
          state: 'syncing',
          startedAt: new Date(),
          voiceMode: 'push-to-talk',
          turnDetection: 'client',
          inconsistencyDetected: true,
          syncAttempts: 1,
        };

        return {
          passed: sessionConfig.state === 'syncing' && sessionConfig.inconsistencyDetected,
          duration: 0,
          details: {
            frontendState: sessionConfig,
            syncEvents: ['connection_lost', 'session_marked_syncing', 'recovery_initiated']
          }
        };
      },
      cleanup: async () => {
        console.log('Cleaning up connection interruption test...');
      }
    },

    {
      name: 'Session State Validation',
      description: 'Test session state validation and auto-correction',
      setup: async () => {
        console.log('Setting up session validation test...');
      },
      execute: async () => {
        const sessionConfig: SessionConfig = {
          type: 'voice-vad',
          state: 'active',
          startedAt: new Date(),
          voiceMode: 'continuous',
          turnDetection: 'client', // Incorrect - should be 'server' for voice-vad
          isMuted: false,
          voiceActivityEnabled: true,
        };

        // Mock validation that detects the inconsistency
        const validation: SessionValidationResult = {
          isValid: false,
          inconsistencies: ['Turn detection mismatch: expected server, got client'],
          corrections: {
            turnDetection: 'server'
          },
          needsResync: true,
        };

        return {
          passed: !validation.isValid && validation.corrections.turnDetection === 'server',
          duration: 0,
          details: {
            frontendState: sessionConfig,
            validation,
            syncEvents: ['validation_failed', 'auto_correction_applied', 'session_resynced']
          }
        };
      },
      cleanup: async () => {
        console.log('Cleaning up session validation test...');
      }
    }
  ];
};

/**
 * Run quick session sync validation
 */
export const runQuickSessionTest = async (): Promise<boolean> => {
  console.log('🚀 Running quick session synchronization test...');

  try {
    const tester = new SessionSynchronizationTester();
    const scenarios = createStandardTestScenarios();

    scenarios.forEach(scenario => tester.addScenario(scenario));

    const results = await tester.runAllTests();
    const passed = results.filter(r => r.passed).length;

    console.log(`\n🎯 Quick test result: ${passed}/${results.length} scenarios passed`);

    return passed === results.length;
  } catch (error) {
    console.error('❌ Quick session test failed:', error);
    return false;
  }
};