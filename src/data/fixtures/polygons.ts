import { hoursAgo } from '@/lib/time'
import type { IntelPolygon } from '@/types/intel'

export function buildFixturePolygons(now = Date.now()): IntelPolygon[] {
  return [
    {
      id: 'poly-catatumbo',
      layer: 'conflicts',
      title: 'Catatumbo contested belt',
      description:
        'Irregular groups and security forces operating across a riverine border belt. Displacement and fuel-smuggling routes overlap.',
      severity: 'high',
      source: 'Regional monitors',
      occurredAt: hoursAgo(20, now),
      country: 'Colombia / Venezuela',
      rings: [
        [
          [-73.4, 9.4],
          [-71.8, 9.6],
          [-71.5, 8.2],
          [-73.1, 7.9],
          [-73.4, 9.4],
        ],
      ],
    },
    {
      id: 'poly-haiti',
      layer: 'conflicts',
      title: 'Port-au-Prince insecurity belt',
      description:
        'Neighborhood control lines shifted after overnight raids. Humanitarian access remains intermittent.',
      severity: 'critical',
      source: 'Open-source desk',
      occurredAt: hoursAgo(6, now),
      country: 'Haiti',
      rings: [
        [
          [-72.55, 18.7],
          [-72.15, 18.68],
          [-72.12, 18.4],
          [-72.52, 18.38],
          [-72.55, 18.7],
        ],
      ],
    },
    {
      id: 'poly-venezuela-sn',
      layer: 'sanctions',
      title: 'Venezuela comprehensive controls',
      description:
        'Mock overlay representing a broad energy and finance control set. Not an official map of legal coverage.',
      severity: 'high',
      source: 'Sanctions tracker',
      occurredAt: hoursAgo(10, now),
      country: 'Venezuela',
      rings: [
        [
          [-73.3, 11.8],
          [-62.0, 10.6],
          [-60.0, 8.4],
          [-61.4, 6.2],
          [-67.5, 1.2],
          [-72.4, 6.8],
          [-73.3, 11.8],
        ],
      ],
    },
    {
      id: 'poly-cuba-sn',
      layer: 'sanctions',
      title: 'Cuba embargo overlay',
      description: 'Illustrative sanctions footprint for the demo. Does not enumerate license exceptions.',
      severity: 'elevated',
      source: 'Sanctions tracker',
      occurredAt: hoursAgo(33, now),
      country: 'Cuba',
      rings: [
        [
          [-84.9, 23.2],
          [-74.2, 21.8],
          [-74.5, 19.8],
          [-85.0, 21.8],
          [-84.9, 23.2],
        ],
      ],
    },
    {
      id: 'poly-storm',
      layer: 'weather',
      title: 'Tropical watch cone — eastern Caribbean',
      description:
        'Forecast uncertainty cone for an organizing tropical wave. Ships advised to monitor 48-hour outlooks.',
      severity: 'high',
      source: 'Open-Meteo (mock)',
      occurredAt: hoursAgo(1, now),
      country: 'Atlantic',
      rings: [
        [
          [-62.5, 17.8],
          [-55.5, 16.6],
          [-55.0, 13.4],
          [-61.8, 13.8],
          [-62.5, 17.8],
        ],
      ],
    },
  ]
}
