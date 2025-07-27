File Map & Responsibilities
ProfilePage.jsx
Role:
Main container/page file.

Responsibilities:

Handles all state, data fetching, API calls, and effect hooks for profile.

Orchestrates layout by importing and assembling all the main modular sections.

Passes all required state and handlers as props to each section.

Handles socket connections and high-level event logic.

ProfileHeader.jsx
Role:
Profile Info Card (Top of Page)

Responsibilities:

Renders avatar, user full name, username, role, theme, bio, and quote.

Action buttons: Friend/Unfriend, Follow/Unfollow, Share.

Calls provided handler props for friend/follow/share actions.

ProfileFriendsSection.jsx
Role:
Friends & Social Buttons

Responsibilities:

Displays top friends avatars and full friends list button.

"Edit Top Friends", "Followers", and "Following" buttons.

Handles open/close logic for friends popups (through parent).

Displays follower/following counts.

ProfileFeedSection.jsx
Role:
Posts / Activity Feed (Left Column)

Responsibilities:

"New Post" button and modal for composing a post.

Displays user's post list, images (gallery), and activity timeline.

Handles props for creating posts and showing activity.

ProfileSidebarSection.jsx
Role:
Right Sidebar

Responsibilities:

Renders groups membership, story highlights, contact/message button.

Privacy/visibility select, interests/skills, recommendations/testimonials.

Purely presentational (all data comes via props).

ProfilePopups.jsx
Role:
All Profile Page Popups/Modals

Responsibilities:

Friends popup (view all friends)

Edit Top Friends modal

Followers and Following popups

Handles all edit/save logic for top friends, closing dialogs, etc.

Called as a single component in ProfilePage with all necessary state/handlers passed in.

How to Use This Map
Updating the user info card?
Edit ProfileHeader.jsx.

Changing the friends/top friends/followers UI?
Edit ProfileFriendsSection.jsx or, for popups, ProfilePopups.jsx.

Adjusting the feed/posts/gallery/timeline?
Edit ProfileFeedSection.jsx.

Styling or updating sidebar content?
Edit ProfileSidebarSection.jsx.

Working on any popups?
Edit ProfilePopups.jsx.

Adding new state/API logic?
Edit ProfilePage.jsx and pass new props down as needed.

Additional Notes
All cross-section state (like user info, lists, popups) is managed at the ProfilePage.jsx level for consistency and can be passed to any section.

Each modular section is responsible only for its own presentational logic; popups are now in a single import for easy maintenance.

If you add a new profile-related feature, consider modularizing it in its own file and referencing it here for the next developer.