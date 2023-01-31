import { Storage } from "../localStorage";
import { BrowserStorage } from "./browserStorage";
import { MetricManager } from "./metrics";
import { SymptomManager } from "./symptoms";

interface App {
  symptomManager: SymptomManager;
  metricManager: MetricManager;
}

export function initialize(): App {
  // Inject dependencies
  const storage = new Storage();
  const symptomManager = new SymptomManager();
  const metricManager = new MetricManager({ symptomManager });
  const browserStorage = new BrowserStorage({ symptomManager, metricManager, storage });

  // Load persisted data
  console.log(`initialize.ts::initialize::Starting initialization...`);

  const symptoms = browserStorage.getSymptoms();
  console.log(`initialize.ts::initialize::${symptoms.length} symptoms found`);
  const metrics = browserStorage.getMetrics();
  console.log(`initialize.ts::initialize::${metrics.length} metrics found`);

  console.log(`initialize.ts::initialize::Initializating ${SymptomManager.name} ...`);
  symptomManager.initialize({ symptoms });
  console.log(`initialize.ts::initialize::Initializating ${MetricManager.name} ...`);
  metricManager.initialize({ metrics });

  console.log(`initialize.ts::initialize::Initialization completed`);

  console.log(`initialize.ts::initialize::Running migrations...`);
  symptomManager.migrate();
  metricManager.migrate();
  console.log(`initialize.ts::initialize::Migrations completed.`);

  return { symptomManager, metricManager };
}
