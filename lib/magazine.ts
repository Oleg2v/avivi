/** Art for each demo article (concept renders, labelled on the page) and the tool it leads to. */
export const articleArt: Record<string, { image: string; tool: { path: string; key: 'plan' | 'visualise' | 'bookVisit' } }> = {
  'small-kitchen-big-storage': { image: 'room-a-light', tool: { path: '/planner', key: 'plan' } },
  'natural-wood-veneer': { image: 'detail-specials', tool: { path: '/visualiser', key: 'visualise' } },
  'before-your-showroom-visit': { image: 'room-c-before', tool: { path: '/book', key: 'bookVisit' } },
};
